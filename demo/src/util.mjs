import crypto from 'node:crypto';
import net from 'node:net';

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Same person, same address: lowercase, trimmed, "+tag" removed; for Gmail also dots removed.
export function normalizeEmail(email) {
  const e = String(email).trim().toLowerCase();
  const at = e.lastIndexOf('@');
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  local = local.split('+')[0];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

export const EMAIL_RE = /^[^\s@"<>(),;:\\[\]]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/i;

export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

export function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y) && String(a).length === String(b).length;
}

export function validTimezone(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return null;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export function formatUntil(date, timezone) {
  const tz = validTimezone(timezone) || 'UTC';
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
  return tz === 'UTC' ? `${s} UTC` : `${s} (${tz.replace(/_/g, ' ')})`;
}

export const isIp = (s) => typeof s === 'string' && net.isIP(s.trim()) !== 0;

// Masks an address for logs: j***@gmail.com
export const maskEmail = (e) => String(e).replace(/^(.)[^@]*/, '$1***');

// Small fixed-window rate limiter kept in memory.
export function rateLimiter(limit, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();
  return (key) => {
    const now = Date.now();
    let v = hits.get(key);
    if (!v || v.reset <= now) {
      v = { n: 0, reset: now + windowMs };
      hits.set(key, v);
    }
    v.n++;
    return v.n <= limit;
  };
}
