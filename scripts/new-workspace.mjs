// Creates a new SalesKnot workspace (a separate CRM on its own subdomain).
// Only the server admin (the first account created on this install) can do this.
//
// Usage (Node 18+, from any computer):
//   node scripts/new-workspace.mjs <admin-email> <admin-password> "<Display name>" <subdomain> --owner-approved [--edition]
// Examples:
//   node scripts/new-workspace.mjs you@opsknot.com 'secret' "Acme Traders" acme --owner-approved
//   node scripts/new-workspace.mjs you@opsknot.com 'secret' "Real Estate" real-estate --owner-approved --edition
//
// Rules (owner, 2026-10-14):
// - The owner checks every customer subdomain by hand (no reserved or abusive words) and only then
//   runs this with --owner-approved.
// - Subdomains in scripts/reserved-subdomains.json are refused for customers. --edition creates one of
//   our own edition workspaces and only accepts a slug listed under "editions" there.
// - New workspaces start empty: no sample data, no payment gateway (added only when a customer asks).
//
// Then open https://<subdomain>.salesknot.app, sign in with the same account and finish the short setup.

const BASE_DOMAIN = process.env.SALESKNOT_DOMAIN || 'salesknot.app';
const ADMIN_SUBDOMAIN = process.env.SALESKNOT_ADMIN_SUBDOMAIN; // optional: a workspace the admin already belongs to

import { readFileSync } from 'node:fs';

const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const [email, password, displayName, rawSubdomain] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!email || !password || !displayName || !rawSubdomain) {
  console.error('Usage: node scripts/new-workspace.mjs <admin-email> <admin-password> "<Display name>" <subdomain> --owner-approved [--edition]');
  process.exit(1);
}

const subdomain = rawSubdomain.trim().toLowerCase();
const reserved = JSON.parse(readFileSync(new URL('./reserved-subdomains.json', import.meta.url), 'utf8'));
const isEdition = flags.has('--edition');
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

if (!/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(subdomain) || subdomain.includes('--'))
  fail(`"${subdomain}" is not a valid subdomain: 3-30 characters, lowercase letters, digits and single hyphens.`);
if (isEdition) {
  if (!reserved.editions.includes(subdomain))
    fail(`"${subdomain}" is not an edition. Add it to "editions" in scripts/reserved-subdomains.json first.`);
} else {
  const hit = Object.entries(reserved).find(([k, list]) => !k.startsWith('_') && list.includes(subdomain));
  if (hit) fail(`"${subdomain}" is reserved (${hit[0]}). Ask the customer for another subdomain.`);
}
if (!flags.has('--owner-approved'))
  fail(`Not created. The owner must check "${subdomain}" by hand first, then run this again with --owner-approved.`);

const origin = `https://${ADMIN_SUBDOMAIN || 'my'}.${BASE_DOMAIN}`;

const gql = async (query, variables, token) => {
  const res = await fetch(`${origin}/metadata`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
};

// Your admin account signs in through a workspace it belongs to (e.g. SALESKNOT_ADMIN_SUBDOMAIN=core)
const { getLoginTokenFromCredentials } = await gql(
  `mutation($e: String!, $p: String!, $o: String!) {
    getLoginTokenFromCredentials(email: $e, password: $p, origin: $o) { loginToken { token } }
  }`,
  { e: email, p: password, o: origin },
).catch((err) => {
  if (/Workspace not found/i.test(err.message) && !ADMIN_SUBDOMAIN)
    fail('Sign-in needs one of your existing workspaces. Run it again with SALESKNOT_ADMIN_SUBDOMAIN=<workspace> in front, e.g. SALESKNOT_ADMIN_SUBDOMAIN=core node scripts/new-workspace.mjs ...');
  throw err;
});
const { getAuthTokensFromLoginToken } = await gql(
  `mutation($l: String!, $o: String!) {
    getAuthTokensFromLoginToken(loginToken: $l, origin: $o) {
      tokens { accessOrWorkspaceAgnosticToken { token } }
    }
  }`,
  { l: getLoginTokenFromCredentials.loginToken.token, o: origin },
);
const token = getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;

const { signUpInNewWorkspace } = await gql(
  `mutation($i: SignUpInNewWorkspaceInput) {
    signUpInNewWorkspace(input: $i) { workspace { id workspaceUrls { subdomainUrl } } }
  }`,
  { i: { displayName, subdomain } },
  token,
);

console.log(`Created "${displayName}": ${signUpInNewWorkspace.workspace.workspaceUrls.subdomainUrl}`);
console.log('Open it, sign in with the same account and finish the short setup.');
