// Removes the remaining "Twenty" names and twenty.com links that users can see: web app text in every
// language, server messages (emails, invitations, errors, 2FA issuer, AI assistant prompts) and help links.
// Runs during `docker build` after apply-branding.sh. Code identifiers (TwentyConfigService, X-Twenty-Webhook-*
// headers, the "Twenty Config" HTML marker) are left alone so the app keeps working, and the upstream
// legal entity names ("Twenty.com PBC") are kept where they appear.
import fs from 'node:fs';
import path from 'node:path';

const env = process.env;
const NAME = env.BRAND_NAME;
const SITE = env.BRAND_WEBSITE;
const DOCS = env.BRAND_DOCS_URL;
const CONTACT = env.BRAND_CONTACT_URL || env.BRAND_WEBSITE;
const SOURCE = env.BRAND_SOURCE_URL;
const APP_DOMAIN = env.BRAND_APP_DOMAIN;

const FRONT = '/app/packages/twenty-server/dist/front/assets';
const SERVER = '/app/packages/twenty-server/dist';
const EMAILS = '/app/packages/twenty-emails/dist';

// "Twenty" as a word, not part of an identifier, a header name or "Twenty.com <entity>"
const WORD = /(?<![A-Za-z0-9_$\-])Twenty(?![A-Za-z0-9_$]|\.com| Config -->)/g;

const links = [
  [/https:\/\/docs\.twenty\.com[^"'`\s)\]\\]*/g, DOCS],
  [/https:\/\/(?:www\.)?twenty\.com\/developers[^"'`\s)\]\\]*/g, DOCS],
  [/https:\/\/(?:www\.)?twenty\.com\/(?:[a-z]{2}\/)?releases[^"'`\s)\]\\]*/g, SITE],
  [/https:\/\/(?:www\.)?twenty\.com\/(?:[a-z]{2}\/)?partners[^"'`\s)\]\\]*/g, CONTACT],
  [/https:\/\/cal\.com\/team\/twenty[^"'`\s)\]\\]*/g, CONTACT],
  [/https:\/\/(?:x|twitter)\.com\/twentycrm[^"'`\s)\]\\]*/g, SITE],
  [/https:\/\/chatgpt\.com\/apps\/twenty[^"'`\s)\]\\]*/g, DOCS],
  [/https:\/\/hub\.docker\.com\/r\/twentycrm\/twenty\/tags\?name=/g, SOURCE + '?version='],
  [/https:\/\/github\.com\/twentyhq\/twenty(?![\w-])/g, SOURCE],
  [/(["'`])https:\/\/(?:www\.)?twenty\.com\/?(["'`])/g, `$1${SITE}$2`],
  [/yourco\.twenty\.com/g, `yourco.${APP_DOMAIN}`],
  [/\b([a-z]+(?:\.[a-z]+)?)@twenty\.com\b/g, '$1@example.com'],
  [/Felix from Twenty/g, NAME],
  // second line of the email footer, under the company name (upstream shows its own offices)
  [/i18n\._\("San Francisco \/ Paris"\)/g, JSON.stringify(new URL(SITE).host)],
  // name of the MCP server in the copy-paste configs on Settings > APIs & MCP
  [/server:\{name:"twenty",/g, `server:{name:"${NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')}",`],
];

// The "SOC2" and "GDPR" seals on the onboarding screen are Twenty's own certifications, not ours.
const trustBadges =
  /\[\(0,[A-Za-z_$]+\.jsx\)\([A-Za-z_$]+,\{label:"SOC2",sealSrc:`[^`]*`\}\),\(0,[A-Za-z_$]+\.jsx\)\([A-Za-z_$]+,\{label:"GDPR",sealSrc:`[^`]*`\}\)\]/g;

const skipDir = /(__tests__|__mocks__|dev-seeder|\/dpa(\/|$)|\/front$)/;
const isCode = (f) => /\.m?js$/.test(f) && !/\.(spec|test)\.m?js$/.test(f);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!skipDir.test(p)) yield* walk(p);
    } else if (isCode(p)) yield p;
  }
}

let changed = 0;
const seen = new Set();
for (const root of [FRONT, SERVER, EMAILS]) {
  for (const f of walk(root)) {
    if (seen.has(f)) continue;
    seen.add(f);
    const before = fs.readFileSync(f, 'utf8');
    let s = before;
    for (const [re, to] of links) s = s.replace(re, to);
    s = s.replace(trustBadges, '[]').replace(WORD, NAME);
    if (s !== before) {
      fs.writeFileSync(f, s);
      changed++;
    }
  }
}
console.log(`strip-twenty: updated ${changed} files`);
