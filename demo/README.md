# SalesKnot demo gateway

A small service (`demo` in `docker-compose.yml`) that lets visitors of opsknot.com try a SalesKnot
edition for 7 days without a password, once the owner approves them:

1. The opsknot.com website's server sends a booking to `POST /demo/api/bookings`.
2. The gateway stores it in its own database (`salesknot_demos`) as waiting for approval. Nothing is
   emailed yet. One booking per email per edition.
   The owner checks who booked, then runs `cli.mjs approve <email> <edition>`, which emails a magic
   link `https://salesknot.app/demo/go/<token>` (or `decline` to turn it down).
3. Clicking the link signs the visitor straight into that edition's demo workspace
   (`https://<subdomain>.salesknot.app`). The link works as often as they like for 7 days.
4. After 7 days the link shows "This demo link has expired", and an hourly job removes the visitor
   from the workspace, which also ends any session they still have open.

Nobody can get into a demo workspace without an approved booking: visitors never get a password, the
workspaces' public invite link is switched off, and only the gateway adds people.

Everything is under `/demo/`, so nginx passes it through unchanged:

```nginx
location ^~ /demo/ { proxy_pass http://demo:8080; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
```

## Editions

Edit `EDITIONS` in `src/config.mjs` to change names, subdomains or which ones can be booked.

| slug (what the website sends) | name | workspace | bookable |
|---|---|---|---|
| `core` | Core CRM | core.salesknot.app | yes |
| `call-centre` | Call Centre | call-centre.salesknot.app | yes |
| `real-estate` | Real Estate | real-estate.salesknot.app | yes |
| `travel-tours-and-visa` | Travel Tours & Visa | travel-tours-and-visa.salesknot.app | yes |
| `legal-law` | Legal & Law | | coming soon |
| `import-export` | Import & Export | | coming soon |

Workspace addresses are built from `SERVER_URL` (`https://<subdomain>.salesknot.app`). To point an
edition somewhere else, set `DEMO_WORKSPACE_URLS`, e.g. `{"call-centre":"https://callcentre.salesknot.app"}`.

## API (for the website's server)

`POST https://salesknot.app/demo/api/bookings` with `Authorization: Bearer <DEMO_API_SECRET>` and JSON:

```json
{ "firstName": "Ayesha", "lastName": "Khan", "email": "ayesha@example.com", "edition": "real-estate",
  "phone": "+92 300 1234567", "message": "…", "timezone": "Asia/Karachi", "country": "PK", "ip": "203.0.113.9" }
```

`phone`, `message`, `timezone` (IANA name, used for the date in the email), `country` (2 letters) and
`ip` (the visitor's IP) are optional.

| status | body | when |
|---|---|---|
| 201 | `{"ok":true,"pending":true}` | booking stored, waiting for the owner's approval (no email yet) |
| 409 | `{"error":"This email has already requested a Real Estate demo. We'll be in touch by email, or you can contact us."}` | that email already booked that edition. Emails are compared trimmed and lowercased, without `+tags`, and for Gmail without dots |
| 400 | `{"error":"…"}` | unknown or coming-soon edition, bad email, missing name, bad JSON |
| 401 | `{"error":"Unauthorized"}` | wrong or missing secret |
| 429 | `{"error":"…"}` | more than 30 bookings a minute from one address, or repeated wrong secrets |

The `error` sentences are written to be shown to the visitor. Call this only from a server, never a browser.

## How sign-in works

Each booking gets its own SalesKnot login, `demo-visitors+sk-<random>@<your domain>` (from
`DEMO_VISITOR_MAILBOX`), with a password derived from `DEMO_SECRET_KEY` that nobody sees. The
visitor's real email is only used for the magic-link email. On the first click the gateway, signed in
as the demo-admin, adds that login to the workspace; on every click it asks the server for a fresh
one-time login token and redirects to `https://<subdomain>.salesknot.app/verify?loginToken=…`, which
is SalesKnot's normal sign-in landing page.

GraphQL mutations used (all on `/metadata`, called inside the Docker network at `http://server:3000`
with no `Origin` header; the workspace is chosen by the `origin` argument):

| mutation | by | why |
|---|---|---|
| `getLoginTokenFromCredentials(email, password, origin)` | demo-admin, visitor | admin session; a fresh one-time login token for the visitor on each click. For a login with a pending invitation it also joins the workspace with the invitation's role |
| `getAuthTokensFromLoginToken(loginToken, origin)` | demo-admin | turns the admin's login token into an access token |
| `sendInvitations(emails, roleId)` | demo-admin | invites the visitor's login with the "Demo visitor" role. Needed because sign-up is limited to people with an invitation, and it sets the role at join time |
| `signUp(email, password)` | public | creates the visitor's login (allowed only because it has an invitation) |
| `updateWorkspaceMemberSettings(input: {workspaceMemberId, update: {name}})` | demo-admin | shows the visitor's real name and completes the "create your profile" step, so they land straight in the CRM |
| `updateWorkspaceMemberRole(workspaceMemberId, roleId)` | demo-admin | only if the member somehow lacks the visitor role |
| `deleteUserFromWorkspace(workspaceMemberIdToDelete)` | demo-admin | removes the visitor when the demo ends or is revoked. Their login belongs to no other workspace, so it is deleted too, and their open sessions are refused from the next request |
| `createOneRole`, `updateOneRole`, `upsertPermissionFlags`, `updateWorkspace(isPublicInviteLinkEnabled: false)`, `updateWorkspaceMemberSettings` | demo-admin | one-time setup (`cli.mjs setup`) |

Why not the public invite link: `signUpInWorkspace` with the workspace's invite hash would let anyone
with the link join, so it is switched off and the gateway uses personal invitations instead.

If the server requires verified emails (`IS_EMAIL_VERIFICATION_REQUIRED=true`), the gateway marks
its own visitor logins as verified directly in the SalesKnot database (`PG_DATABASE_URL`), since
nobody reads that mailbox. Default installs don't need this. If you turn on a captcha for sign-in,
the gateway's server-side calls will be refused; leave captcha off.

## The "Demo visitor" role

Created by `cli.mjs setup` in each workspace: can read, create, edit and soft-delete records, upload
and download files. No settings at all (no members, roles, API keys, webhooks, data model, workspace
deletion, billing), no permanent deletes, no AI tools, no CSV import/export, no workflow editing,
cannot edit its own profile email. In Settings a visitor only sees their Profile and Experience pages.

**Visitors of the same edition share the workspace and can see each other's records.** That is
accepted for now; the email asks them not to enter real customer data. Each workspace should also
contain no placeholder or sample records (delete them once in each demo workspace).

## One-time setup on the server

1. Create the four demo workspaces if they don't exist (`scripts/new-workspace.mjs`, subdomains
   `core`, `call-centre`, `real-estate`, `travel-tours-and-visa`), install the edition's pack, and
   remove any sample records.
2. Make sure outgoing email works (`EMAIL_DRIVER=smtp` and the `EMAIL_SMTP_*` settings in `.env`).
3. Fill in the demo settings in `.env` (see `.env.example`):
   `DEMO_API_SECRET` and `DEMO_SECRET_KEY` (each `openssl rand -hex 32`), `PUBLIC_BASE_URL`,
   `DEMO_DAYS`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` (a new strong password), `DEMO_VISITOR_MAILBOX`
   (a mailbox you own; SalesKnot sends one "Join your team" email per visitor login there, so make
   a filter that deletes them).
4. Start it: `docker compose up -d --build demo`
5. Add the demo-admin as Admin to all four workspaces (you sign in once with your own admin account,
   which must be a member of each):
   `docker compose exec demo node src/cli.mjs bootstrap you@opsknot.com 'your-password'`
   (or invite `DEMO_ADMIN_EMAIL` as Admin by hand from Settings > Members in each workspace).
6. Create the visitor role and close the public invite link in each workspace:
   `docker compose exec demo node src/cli.mjs setup`
   Run it again whenever you add a workspace. Don't add "approved access domains" to demo workspaces
   (setup warns if there are any): they would let people join without a booking.
7. Give `DEMO_API_SECRET` to the opsknot.com website's server.

Keep your own admin account in each demo workspace too, and don't remove the demo-admin or change
its password without updating `.env`: the gateway signs in with it.

## Settings

| variable | default | |
|---|---|---|
| `DEMO_API_SECRET` | required | bearer secret shared with the website's server |
| `DEMO_SECRET_KEY` | required | private; derives visitor passwords. Changing it locks out current visitors |
| `PUBLIC_BASE_URL` | `https://salesknot.app` | base of the magic link |
| `DEMO_DAYS` | `7` | how long a demo lasts |
| `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` | required | the account that is Admin in every demo workspace |
| `DEMO_VISITOR_MAILBOX` | `demo-visitors@salesknot.app` | base address for visitor logins |
| `DEMO_SWEEP_MINUTES` | `60` | how often expired visitors are removed |
| `DEMO_WORKSPACE_URLS` | | JSON map slug -> workspace URL, overrides `SERVER_URL` |
| `DEMO_DATABASE_URL` | `PG_DATABASE_URL` with database `salesknot_demos` | set it when using Neon |
| `DEMO_SERVER_INTERNAL_URL` | `http://server:3000` | how the gateway reaches SalesKnot |
| `DEMO_CONTACT_URL` | `https://opsknot.com/contact/booking/` | link on the expired page and in the email |
| `DEMO_REPLY_TO` | | optional Reply-To for the demo email |
| `EMAIL_DRIVER`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_SMTP_NO_TLS`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` | shared with SalesKnot | port 465 uses TLS from the start, others use STARTTLS |

## Checking bookings

```sh
docker compose exec demo node src/cli.mjs list                        # all bookings, newest first; new ones say WAITING FOR APPROVAL
docker compose exec demo node src/cli.mjs approve ayesha@example.com real-estate      # email her the demo link (7 days)
docker compose exec demo node src/cli.mjs approve ayesha@example.com real-estate 3    # same, link works 3 days (1-30); run again to resend a fresh link
docker compose exec demo node src/cli.mjs decline ayesha@example.com real-estate      # turn it down; that email can't book this edition again
docker compose exec demo node src/cli.mjs invite ali@example.com core Ali Raza        # demo for someone who asked by email/WhatsApp (no booking)
docker compose exec demo node src/cli.mjs revoke ayesha@example.com real-estate   # end a demo now
docker compose exec demo node src/cli.mjs forget ayesha@example.com real-estate   # end it and let that email book again
docker compose exec demo node src/cli.mjs sweep                       # remove expired visitors now
docker compose logs -f demo
```

The database is `salesknot_demos` in the `db` container (table `bookings`), created on first start.
Tokens are never stored (only a SHA-256 hash) and never logged; logs show booking ids and masked emails.

## Notes

- Email security scanners (e.g. Outlook Safe Links) may open the link before the visitor does. That
  only marks the booking as opened; the link keeps working.
- SalesKnot limits invitations to 500 per workspace per week, so one edition can take up to about
  500 first-time demo opens a week.
- Files: `src/server.mjs` (HTTP), `src/bookings.mjs` (booking logic, expiry job), `src/twenty.mjs`
  (SalesKnot API), `src/email.mjs`, `src/pages.mjs`, `src/db.mjs` (migrations), `src/cli.mjs`,
  `src/config.mjs` (editions and settings).
