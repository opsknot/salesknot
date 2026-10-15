// All settings in one place. Editions are listed here; everything else comes from the environment.

// Bookable demo editions. The key is the slug the website sends; `subdomain` is the demo workspace
// (https://<subdomain>.salesknot.app). Set `bookable: false` for editions that are not ready yet.
export const EDITIONS = {
  core: { name: 'Core CRM', subdomain: 'core', bookable: true },
  'call-centre': {
    name: 'Call Centre',
    subdomain: 'call-centre',
    bookable: true,
    // "Try the automations" steps in the demo email: each one shows a built-in automation firing
    tryThis: [
      'Create a campaign, then add a person to its call list. The entry is named and its first call is due now.',
      'Log a call with the outcome Callback and a time. The entry moves to Callback and you get a task for that time.',
      'Log a call with the outcome Interested. An opportunity opens for you automatically.',
      'Tick "Do not call" on a person. All their open call list entries stop at once.',
    ],
  },
  'real-estate': { name: 'Real Estate', subdomain: 'real-estate', bookable: true },
  'travel-tours-and-visa': {
    name: 'Travel Tours & Visa',
    subdomain: 'travel-tours-and-visa',
    bookable: true,
    tryThis: [
      'Add a visa type with a fee and a document checklist.',
      'Open a case with that visa type. The case number, fee and checklist fill in by themselves.',
      'Add a payment to the case. It gets a receipt number and the balance due is recalculated.',
      'Move an enquiry to Converted. The contact becomes a client and a visa case opens.',
    ],
  },
  'legal-law': { name: 'Legal & Law', subdomain: 'legal-law', bookable: false },
  'import-export': { name: 'Import & Export', subdomain: 'import-export', bookable: false },
};

const env = process.env;
const int = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
const trimSlash = (u) => String(u).replace(/\/+$/, '');

// Public address of salesknot.app, used to build https://<subdomain>.<host> workspace addresses.
const serverUrl = new URL(env.SERVER_URL || 'https://salesknot.app');

// Optional per-edition override, e.g. {"call-centre":"http://callcentre.localhost:3000"}
let workspaceUrlOverrides = {};
if (env.DEMO_WORKSPACE_URLS) {
  try {
    workspaceUrlOverrides = JSON.parse(env.DEMO_WORKSPACE_URLS);
  } catch {
    throw new Error('DEMO_WORKSPACE_URLS must be JSON, e.g. {"core":"https://core.salesknot.app"}');
  }
}

export const workspaceUrl = (slug) =>
  trimSlash(workspaceUrlOverrides[slug] || `${serverUrl.protocol}//${EDITIONS[slug].subdomain}.${serverUrl.host}`);

const pgUrl = env.PG_DATABASE_URL || (env.DB_PASSWORD ? `postgres://salesknot:${encodeURIComponent(env.DB_PASSWORD)}@db:5432/salesknot` : '');
const demoDbUrl = () => {
  if (env.DEMO_DATABASE_URL) return env.DEMO_DATABASE_URL;
  if (!pgUrl) return '';
  const u = new URL(pgUrl);
  u.pathname = '/salesknot_demos';
  return u.toString();
};

export const config = {
  port: int(env.DEMO_PORT, 8080),
  publicBaseUrl: trimSlash(env.PUBLIC_BASE_URL || 'https://salesknot.app'),
  apiSecret: env.DEMO_API_SECRET || '',
  secretKey: env.DEMO_SECRET_KEY || '',
  demoDays: int(env.DEMO_DAYS, 7),
  sweepMinutes: int(env.DEMO_SWEEP_MINUTES, 60),
  contactUrl: env.DEMO_CONTACT_URL || 'https://opsknot.com/contact/booking/',
  logoUrl: env.DEMO_LOGO_URL || 'https://salesknot.app/images/icons/windows11/Square150x150Logo.scale-100.png',
  // SalesKnot server, reached inside the Docker network (never through Cloudflare)
  twentyUrl: trimSlash(env.DEMO_SERVER_INTERNAL_URL || 'http://server:3000'),
  adminEmail: env.DEMO_ADMIN_EMAIL || '',
  adminPassword: env.DEMO_ADMIN_PASSWORD || '',
  visitorRoleLabel: env.DEMO_VISITOR_ROLE || 'Demo visitor',
  // Each visitor gets a SalesKnot login <local>+sk-<id>@<domain> derived from this mailbox.
  visitorMailbox: (env.DEMO_VISITOR_MAILBOX || 'demo-visitors@salesknot.app').toLowerCase(),
  databaseUrl: demoDbUrl(),
  // Only used when the server requires verified emails (IS_EMAIL_VERIFICATION_REQUIRED=true)
  twentyDatabaseUrl: pgUrl,
  email: {
    driver: String(env.EMAIL_DRIVER || 'LOGGER').toUpperCase(),
    host: env.EMAIL_SMTP_HOST || '',
    port: int(env.EMAIL_SMTP_PORT, 587),
    user: env.EMAIL_SMTP_USER || '',
    password: env.EMAIL_SMTP_PASSWORD || '',
    noTls: /^(1|true|yes)$/i.test(env.EMAIL_SMTP_NO_TLS || ''),
    name: env.EMAIL_SMTP_NAME || undefined,
    fromAddress: env.EMAIL_FROM_ADDRESS || 'no-reply@salesknot.app',
    fromName: env.EMAIL_FROM_NAME || 'SalesKnot',
    replyTo: env.DEMO_REPLY_TO || undefined,
  },
};

export function assertConfig({ needApi = true } = {}) {
  const missing = [];
  if (needApi && config.apiSecret.length < 24) missing.push('DEMO_API_SECRET (at least 24 characters)');
  if (config.secretKey.length < 32) missing.push('DEMO_SECRET_KEY (at least 32 characters)');
  if (!config.adminEmail || !config.adminPassword) missing.push('DEMO_ADMIN_EMAIL / DEMO_ADMIN_PASSWORD');
  if (!config.databaseUrl) missing.push('DEMO_DATABASE_URL (or DB_PASSWORD / PG_DATABASE_URL)');
  if (!/^[^@\s+]+@[^@\s]+\.[^@\s]+$/.test(config.visitorMailbox)) missing.push('DEMO_VISITOR_MAILBOX (a plain address like demo-visitors@salesknot.app)');
  if (missing.length) throw new Error(`Missing or invalid settings: ${missing.join(', ')}`);
}
