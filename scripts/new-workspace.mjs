// Creates a new SalesKnot workspace (a separate CRM on its own subdomain).
// Only the server admin (the first account created on this install) can do this.
//
// Usage (Node 18+, from any computer):
//   node scripts/new-workspace.mjs <admin-email> <admin-password> "<Display name>" <subdomain>
// Example:
//   node scripts/new-workspace.mjs you@opsknot.com 'secret' "Real Estate Demo" realestate
//
// Then open https://<subdomain>.salesknot.app, sign in with the same account and finish the
// short setup. Note: some subdomains are reserved by the platform (e.g. app, demo, legal, www).

const BASE_DOMAIN = process.env.SALESKNOT_DOMAIN || 'salesknot.app';
const ADMIN_SUBDOMAIN = process.env.SALESKNOT_ADMIN_SUBDOMAIN; // optional: a workspace the admin already belongs to

const [, , email, password, displayName, subdomain] = process.argv;
if (!email || !password || !displayName || !subdomain) {
  console.error('Usage: node scripts/new-workspace.mjs <admin-email> <admin-password> "<Display name>" <subdomain>');
  process.exit(1);
}

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

const { getLoginTokenFromCredentials } = await gql(
  `mutation($e: String!, $p: String!, $o: String!) {
    getLoginTokenFromCredentials(email: $e, password: $p, origin: $o) { loginToken { token } }
  }`,
  { e: email, p: password, o: origin },
);
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
