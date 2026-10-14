// Talks to the SalesKnot server's GraphQL API (/metadata) from inside the Docker network.
//
// Mutations used (see README "How sign-in works"):
//   getLoginTokenFromCredentials  - demo-admin session, and a fresh one-time login token for a visitor
//   getAuthTokensFromLoginToken   - turns the demo-admin's login token into an access token
//   sendInvitations               - demo-admin invites the visitor's login with the "Demo visitor" role
//   signUp                        - creates the visitor's login (allowed only because it has an invitation)
//   updateWorkspaceMemberSettings - sets the visitor's name, which also completes the "create profile" step
//   updateWorkspaceMemberRole     - safety net if the member did not get the visitor role
//   deleteUserFromWorkspace       - removes the visitor when the demo expires (ends their sessions)
//   createOneRole / upsertPermissionFlags / updateWorkspace - one-time setup (cli.mjs setup)
import crypto from 'node:crypto';
import pg from 'pg';
import { config, workspaceUrl } from './config.mjs';

export class TwentyError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

async function gql(query, variables, token) {
  // No Origin header on purpose: the server picks the workspace from the `origin` argument.
  const res = await fetch(`${config.twentyUrl}/metadata`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new TwentyError(`SalesKnot server answered ${res.status}`, 'HTTP_' + res.status);
  }
  if (json.errors?.length) {
    const e = json.errors[0];
    throw new TwentyError(e.message, e.extensions?.subCode || e.extensions?.code || 'GRAPHQL_ERROR');
  }
  return json.data;
}

// ---- demo-admin session per workspace (cached for a few minutes) ----
const adminTokens = new Map();

async function loginToken(slug, email, password) {
  const d = await gql(
    `mutation($e: String!, $p: String!, $o: String!) {
       getLoginTokenFromCredentials(email: $e, password: $p, origin: $o) { loginToken { token } }
     }`,
    { e: email, p: password, o: workspaceUrl(slug) },
  );
  return d.getLoginTokenFromCredentials.loginToken.token;
}

async function adminToken(slug) {
  const cached = adminTokens.get(slug);
  if (cached && cached.until > Date.now()) return cached.token;
  const lt = await loginToken(slug, config.adminEmail, config.adminPassword);
  const d = await gql(
    `mutation($l: String!, $o: String!) {
       getAuthTokensFromLoginToken(loginToken: $l, origin: $o) { tokens { accessOrWorkspaceAgnosticToken { token } } }
     }`,
    { l: lt, o: workspaceUrl(slug) },
  );
  const token = d.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
  adminTokens.set(slug, { token, until: Date.now() + 10 * 60 * 1000 });
  return token;
}

async function asAdmin(slug, query, variables) {
  try {
    return await gql(query, variables, await adminToken(slug));
  } catch (err) {
    if (/UNAUTHENTICATED|TOKEN|EXPIRED/i.test(err.code || '') || /token/i.test(err.message)) {
      adminTokens.delete(slug);
      return gql(query, variables, await adminToken(slug));
    }
    throw err;
  }
}

// ---- visitor logins ----

// The visitor's password is derived from DEMO_SECRET_KEY, so it is never stored or shown to anyone.
export const visitorPassword = (workspaceEmail) =>
  'Sk!' + crypto.createHmac('sha256', config.secretKey).update('visitor:' + workspaceEmail).digest('base64url');

export function newVisitorEmail() {
  const [local, domain] = config.visitorMailbox.split('@');
  return `${local}+sk-${crypto.randomBytes(6).toString('hex')}@${domain}`;
}

const roleIds = new Map();
async function visitorRoleId(slug) {
  if (roleIds.has(slug)) return roleIds.get(slug);
  const { getRoles } = await asAdmin(slug, `{ getRoles { id label } }`);
  const role = getRoles.find((r) => r.label === config.visitorRoleLabel);
  if (!role) throw new TwentyError(`Role "${config.visitorRoleLabel}" not found; run: node src/cli.mjs setup`, 'SETUP_MISSING');
  roleIds.set(slug, role.id);
  return role.id;
}

export async function findMember(slug, workspaceEmail) {
  const { currentUser } = await asAdmin(slug, `{ currentUser { workspaceMembers { id userEmail roles { id label } } } }`);
  return currentUser.workspaceMembers.find((m) => m.userEmail?.toLowerCase() === workspaceEmail.toLowerCase()) || null;
}

async function markEmailVerified(workspaceEmail) {
  // Only reached when the server requires verified emails: visitor logins use an internal mailbox,
  // so they are marked verified directly in the SalesKnot database.
  if (!config.twentyDatabaseUrl) throw new TwentyError('Email verification is required but PG_DATABASE_URL is not set', 'EMAIL_NOT_VERIFIED');
  const c = new pg.Client({ connectionString: config.twentyDatabaseUrl });
  await c.connect();
  try {
    await c.query('UPDATE core."user" SET "isEmailVerified" = true WHERE lower(email) = lower($1)', [workspaceEmail]);
  } finally {
    await c.end();
  }
}

async function visitorLoginToken(slug, workspaceEmail) {
  try {
    return await loginToken(slug, workspaceEmail, visitorPassword(workspaceEmail));
  } catch (err) {
    if (err.code === 'EMAIL_NOT_VERIFIED') {
      await markEmailVerified(workspaceEmail);
      return loginToken(slug, workspaceEmail, visitorPassword(workspaceEmail));
    }
    throw err;
  }
}

// Creates the visitor's login and adds it to the edition's workspace with the visitor role.
// Safe to call again after a partial failure.
export async function provisionVisitor(slug, workspaceEmail, { firstName, lastName }) {
  let member = await findMember(slug, workspaceEmail);
  if (!member) {
    const roleId = await visitorRoleId(slug);
    const inv = await asAdmin(
      slug,
      `mutation($e: [String!]!, $r: UUID) { sendInvitations(emails: $e, roleId: $r) { success errors } }`,
      { e: [workspaceEmail], r: roleId },
    );
    if (!inv.sendInvitations.success) throw new TwentyError(inv.sendInvitations.errors.join('; '), 'INVITE_FAILED');
    try {
      await gql(`mutation($e: String!, $p: String!) { signUp(email: $e, password: $p) { tokens { accessOrWorkspaceAgnosticToken { token } } } }`, {
        e: workspaceEmail,
        p: visitorPassword(workspaceEmail),
      });
    } catch (err) {
      if (err.code !== 'USER_ALREADY_EXISTS') throw err;
    }
    // Signing in with a pending invitation joins the workspace with the invitation's role.
    await visitorLoginToken(slug, workspaceEmail);
    member = await findMember(slug, workspaceEmail);
    if (!member) throw new TwentyError('Visitor did not join the workspace', 'JOIN_FAILED');
  }
  const roleId = await visitorRoleId(slug);
  if (!member.roles?.some((r) => r.id === roleId)) {
    await asAdmin(slug, `mutation($m: UUID!, $r: UUID!) { updateWorkspaceMemberRole(workspaceMemberId: $m, roleId: $r) { id } }`, {
      m: member.id,
      r: roleId,
    });
  }
  await asAdmin(slug, `mutation($i: UpdateWorkspaceMemberSettingsInput!) { updateWorkspaceMemberSettings(input: $i) }`, {
    i: { workspaceMemberId: member.id, update: { name: { firstName: firstName.slice(0, 60), lastName: lastName.slice(0, 60) } } },
  });
  return member.id;
}

// A fresh one-time login token; the workspace's /verify page exchanges it for a session.
export async function signInUrl(slug, workspaceEmail) {
  const token = await visitorLoginToken(slug, workspaceEmail);
  return `${workspaceUrl(slug)}/verify?loginToken=${encodeURIComponent(token)}`;
}

// Removes the visitor from the workspace. Their login is deleted with it (it belongs to no other
// workspace), and the server rejects their existing sessions from the next request on.
export async function removeVisitor(slug, workspaceEmail, memberId) {
  if (!workspaceEmail.endsWith('@' + config.visitorMailbox.split('@')[1]) || !workspaceEmail.includes('+sk-')) {
    throw new TwentyError('Refusing to remove a login that the demo gateway did not create', 'NOT_A_DEMO_LOGIN');
  }
  // Match on the member id saved at sign-up too, in case the login's email was changed since.
  const { currentUser } = await asAdmin(slug, `{ currentUser { workspaceMembers { id userEmail } } }`);
  const member = currentUser.workspaceMembers.find(
    (m) => (memberId && m.id === memberId) || m.userEmail?.toLowerCase() === workspaceEmail.toLowerCase(),
  );
  if (!member) return false;
  if (member.userEmail?.toLowerCase() === config.adminEmail.toLowerCase()) throw new TwentyError('Refusing to remove the demo-admin', 'NOT_A_DEMO_LOGIN');
  await asAdmin(slug, `mutation($m: String!) { deleteUserFromWorkspace(workspaceMemberIdToDelete: $m) { id } }`, { m: member.id });
  return true;
}

// ---- one-time setup per workspace (cli.mjs setup) ----
const VISITOR_ROLE = {
  description: 'Demo visitors (managed by the demo gateway). Can use records; no settings.',
  icon: 'IconUserCircle',
  canUpdateAllSettings: false,
  canAccessAllTools: false,
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: true,
  canDestroyAllObjectRecords: false,
  canBeAssignedToUsers: true,
  canBeAssignedToAgents: false,
  canBeAssignedToApiKeys: false,
};
const VISITOR_FLAGS = ['UPLOAD_FILE', 'DOWNLOAD_FILE'];

export async function setupWorkspace(slug) {
  const out = [];
  const { getRoles } = await asAdmin(slug, `{ getRoles { id label } }`);
  let role = getRoles.find((r) => r.label === config.visitorRoleLabel);
  if (!role) {
    const d = await asAdmin(slug, `mutation($i: CreateRoleInput!) { createOneRole(createRoleInput: $i) { id label } }`, {
      i: { id: crypto.randomUUID(), label: config.visitorRoleLabel, ...VISITOR_ROLE },
    });
    role = d.createOneRole;
    out.push(`created role "${role.label}"`);
  } else {
    await asAdmin(slug, `mutation($i: UpdateRoleInput!) { updateOneRole(updateRoleInput: $i) { id } }`, { i: { id: role.id, update: VISITOR_ROLE } });
    out.push(`updated role "${role.label}"`);
  }
  await asAdmin(slug, `mutation($i: UpsertPermissionFlagsInput!) { upsertPermissionFlags(upsertPermissionFlagsInput: $i) { id } }`, {
    i: { roleId: role.id, permissionFlagKeys: VISITOR_FLAGS },
  });
  // Nobody joins a demo workspace through the public invite link; only the gateway adds people.
  await asAdmin(slug, `mutation($d: UpdateWorkspaceInput!) { updateWorkspace(data: $d) { id } }`, { d: { isPublicInviteLinkEnabled: false } });
  out.push('public invite link disabled');
  const me = await findMember(slug, config.adminEmail);
  if (me) {
    await asAdmin(slug, `mutation($i: UpdateWorkspaceMemberSettingsInput!) { updateWorkspaceMemberSettings(input: $i) }`, {
      i: { workspaceMemberId: me.id, update: { name: { firstName: 'SalesKnot', lastName: 'Demo' } } },
    });
  }
  const approved = await asAdmin(slug, `{ getApprovedAccessDomains { domain } }`).catch(() => null);
  const domains = approved?.getApprovedAccessDomains || [];
  if (domains.length) out.push(`WARNING: approved access domains let people join without a booking: ${domains.map((d) => d.domain).join(', ')}`);
  roleIds.delete(slug);
  return out;
}

// Owner-run bootstrap: invites DEMO_ADMIN_EMAIL as Admin to a workspace and creates its login.
export async function bootstrapAdmin(slug, ownerEmail, ownerPassword) {
  const lt = await loginToken(slug, ownerEmail, ownerPassword);
  const d = await gql(
    `mutation($l: String!, $o: String!) { getAuthTokensFromLoginToken(loginToken: $l, origin: $o) { tokens { accessOrWorkspaceAgnosticToken { token } } } }`,
    { l: lt, o: workspaceUrl(slug) },
  );
  const ownerToken = d.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;
  const { currentUser } = await gql(`{ currentUser { workspaceMembers { userEmail } } }`, {}, ownerToken);
  if (currentUser.workspaceMembers.some((m) => m.userEmail?.toLowerCase() === config.adminEmail.toLowerCase())) return 'demo-admin already a member';
  const { getRoles } = await gql(`{ getRoles { id label } }`, {}, ownerToken);
  const admin = getRoles.find((r) => r.label === 'Admin');
  const inv = await gql(`mutation($e: [String!]!, $r: UUID) { sendInvitations(emails: $e, roleId: $r) { success errors } }`, { e: [config.adminEmail], r: admin?.id }, ownerToken);
  if (!inv.sendInvitations.success) throw new TwentyError(inv.sendInvitations.errors.join('; '), 'INVITE_FAILED');
  try {
    await gql(`mutation($e: String!, $p: String!) { signUp(email: $e, password: $p) { tokens { accessOrWorkspaceAgnosticToken { token } } } }`, {
      e: config.adminEmail,
      p: config.adminPassword,
    });
  } catch (err) {
    if (err.code !== 'USER_ALREADY_EXISTS') throw err;
  }
  await loginToken(slug, config.adminEmail, config.adminPassword); // joins with the Admin role
  return 'demo-admin added as Admin';
}
