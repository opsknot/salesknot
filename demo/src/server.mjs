// SalesKnot demo gateway. Every route lives under /demo/ (nginx passes the path through unchanged).
//   POST /demo/api/bookings   called by the opsknot.com website's server (Bearer DEMO_API_SECRET)
//   GET  /demo/go/<token>     the magic link in the email: signs the visitor into the edition's workspace
//   GET  /demo/health         container health check
import http from 'node:http';
import { assertConfig, config } from './config.mjs';
import { migrate, pool } from './db.mjs';
import { createBooking, HttpError, openLink, sweep } from './bookings.mjs';
import { errorPage, expiredPage, notFoundPage } from './pages.mjs';
import { rateLimiter, safeEqual } from './util.mjs';

assertConfig();
await migrate();

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'cache-control': 'no-store',
};

const send = (res, status, body, type = 'application/json; charset=utf-8', extra = {}) => {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': type, 'content-length': Buffer.byteLength(payload), ...extra });
  res.end(payload);
};
const sendHtml = (res, status, html) =>
  send(res, status, html, 'text/html; charset=utf-8', {
    'content-security-policy': "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  });

// Cloudflare's CF-Connecting-IP when present, else the address nginx appended (last X-Forwarded-For entry).
const clientIp = (req) =>
  String(req.headers['cf-connecting-ip'] || '').trim() ||
  String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() ||
  req.socket.remoteAddress ||
  'unknown';

const bookingLimit = rateLimiter(30, 60 * 1000); // per caller IP (the website's server)
const badAuthLimit = rateLimiter(10, 10 * 60 * 1000);
const linkLimit = rateLimiter(30, 60 * 1000); // per visitor IP

function readJson(req, max = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > max) {
        reject(new HttpError(413, 'Request is too large.'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'));
      } catch {
        reject(new HttpError(400, 'Request body must be JSON.'));
      }
    });
    req.on('error', reject);
  });
}

async function handleBooking(req, res) {
  const ip = clientIp(req);
  const auth = String(req.headers.authorization || '');
  const given = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!given || !safeEqual(given, config.apiSecret)) {
    if (!badAuthLimit(ip)) return send(res, 429, { error: 'Too many attempts. Please try again later.' });
    return send(res, 401, { error: 'Unauthorized' });
  }
  if (!bookingLimit(ip)) return send(res, 429, { error: 'Too many requests. Please try again in a minute.' });
  const body = await readJson(req);
  await createBooking(body);
  return send(res, 201, { ok: true });
}

async function handleLink(req, res, token) {
  if (!linkLimit(clientIp(req))) return sendHtml(res, 429, errorPage());
  let url;
  try {
    url = await openLink(token);
  } catch (err) {
    console.error(`[link] could not sign the visitor in: ${err.code || ''} ${err.message}`);
    return sendHtml(res, 503, errorPage());
  }
  if (!url) return sendHtml(res, 410, expiredPage());
  res.writeHead(302, { ...SECURITY_HEADERS, location: url });
  res.end();
}

const server = http.createServer(async (req, res) => {
  const path = (req.url || '/').split('?')[0];
  try {
    if (path === '/demo/api/bookings') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }, undefined, { allow: 'POST' });
      return await handleBooking(req, res);
    }
    const go = path.match(/^\/demo\/go\/([^/]+)\/?$/);
    if (go && (req.method === 'GET' || req.method === 'HEAD')) return await handleLink(req, res, go[1]);
    if (path === '/demo/health') {
      await pool.query('SELECT 1');
      return send(res, 200, { ok: true });
    }
    if (path === '/demo' || path === '/demo/') {
      res.writeHead(302, { ...SECURITY_HEADERS, location: config.contactUrl });
      return res.end();
    }
    if (path.startsWith('/demo/api/')) return send(res, 404, { error: 'Not found' });
    return sendHtml(res, 404, notFoundPage());
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { error: err.message });
    console.error(`[http] ${req.method} ${path.replace(/\/go\/.*/, '/go/…')}: ${err.message}`);
    if (!res.headersSent) send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
});

server.listen(config.port, () => console.log(`[demo] listening on :${config.port}, demos last ${config.demoDays} days`));

// Remove visitors whose demo has ended, every DEMO_SWEEP_MINUTES (and shortly after start).
const runSweep = () => sweep().catch((err) => console.error(`[sweep] ${err.message}`));
setTimeout(runSweep, 15 * 1000).unref();
setInterval(runSweep, Math.max(1, config.sweepMinutes) * 60 * 1000);

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close();
    pool.end().finally(() => process.exit(0));
  });
}
