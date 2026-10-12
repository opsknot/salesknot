# SalesKnot

The automation-first CRM by OpsKnot. Built on [Twenty](https://github.com/twentyhq/twenty) (AGPL-3.0).

```
salesknot/
├── Dockerfile              # Twenty's official image + SalesKnot branding layer
├── branding/
│   ├── brand.env           # name, tagline, links  <- edit these
│   ├── logo.png            # square logo, 1024x1024 PNG  <- replace with the real logo
│   ├── apply-branding.sh   # applies the branding during the image build
│   └── source-link.html    # "Source code" link on sign-in pages (AGPL requirement)
├── docker-compose.yml      # server + worker + Redis + Cloudflare Tunnel
└── .env.example            # settings for the VPS (copy to .env)
```

Industry packs live in a separate **private** repo, `salesknot-packs` (e.g. `real-estate/`).

## How it fits together

- **Core** = Twenty's official Docker image with our branding layered on top. No fork to maintain:
  upgrading is changing `TWENTY_VERSION` and rebuilding.
- **Industry packs** = Twenty "apps" (objects, fields, views, dashboards, roles, automations)
  installed into a workspace with the `twenty` CLI. Packs are our own code and can stay private
  (Twenty's licence has an explicit exception for apps).
- **Hosting** = VPS runs the app, worker, Redis and SalesKnot's own Postgres container
  (~1.3 GB RAM measured), separate from any other Postgres on the server. Neon is an optional
  alternative for the database.
  Cloudflare Tunnel publishes it on `crm.opsknot.com` with HTTPS, with no ports opened on the VPS.

## 1. One-time accounts

1. **Cloudflare** (domain already on Cloudflare): Zero Trust > Networks > Tunnels > Create a tunnel
   (type "Cloudflared") > name it `salesknot` > copy the **token**.
   Then add a Public Hostname: `crm.opsknot.com` -> Service `HTTP` `server:3000`.

## 2. Install on the VPS (Ubuntu/Debian)

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# The kit (once it is in your GitHub repo)
git clone https://github.com/opsknot/salesknot.git && cd salesknot
cp .env.example .env
nano .env          # fill SERVER_URL, DB_PASSWORD, ENCRYPTION_KEY, CLOUDFLARE_TUNNEL_TOKEN
                   # DB_PASSWORD:    run `openssl rand -hex 24` and paste the result
                   # ENCRYPTION_KEY: run `openssl rand -base64 32` and paste the result

docker compose up -d --build
docker compose logs -f server     # first start runs database setup (a few minutes)
```

Open `https://crm.opsknot.com`, sign up: the first account creates the workspace.

**If the very first start fails** (for example a typo in `.env`), the database can be left half
set up. On a brand-new install only, fix `.env` and run `docker compose down -v && docker compose up -d`
to start clean. Never use `-v` once you have real data: it deletes the database.

### Backups

```bash
# nightly at 02:00, keeps 14 days (add with: crontab -e)
0 2 * * * mkdir -p ~/salesknot/backups && cd ~/salesknot && docker compose exec -T db pg_dump -U salesknot -Fc salesknot > backups/salesknot-$(date +\%F).dump && find backups -name '*.dump' -mtime +14 -delete
```

Copy the `backups/` folder off the server now and then (or to Cloudflare R2).

## 3. Install an industry pack

On your PC or the VPS (needs Node 22+):

1. In SalesKnot: Settings > APIs & Webhooks > create an API key (role: Admin).
2. Then:

```bash
cd salesknot-packs/real-estate
npm install
npx twenty remote:add --as prod --url https://crm.opsknot.com --api-key <API_KEY>
npx twenty apply
```

Re-running `apply` after editing a pack updates the workspace (it shows the plan first).

## Rebranding

Edit `branding/brand.env`, replace `branding/logo.png`, then `docker compose up -d --build`.
What changes: browser tab title, logo and icons everywhere, sign-in page, app text
("Twenty" -> "SalesKnot"), email logo/footer/links, PWA name.

## Upgrading Twenty

Set `TWENTY_VERSION` in `.env` to a newer tag, then `docker compose up -d --build`.
Database migrations run automatically on start. Take a backup first.

## Licence obligations (summary, not legal advice)

- Core is AGPL-3.0: keep the "Source code" link pointing at a public copy of this kit
  (`BRAND_SOURCE_URL`), which together with the upstream Twenty tag is the full source.
- Don't use the Twenty name or logo for the product. "Built on Twenty" is allowed.
- Don't enable Twenty's Enterprise features (SSO, row-level permissions, audit logs) without
  a Twenty Enterprise licence.
- The real-estate pack (in `salesknot-packs`) started from Twenty's MIT-licensed example app.
