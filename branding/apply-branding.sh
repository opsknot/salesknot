#!/bin/sh
# Rebrands a stock Twenty image in place. Runs during `docker build`.
# Keeps changes to static files and user-facing text so upstream upgrades stay a one-line tag bump.
set -eu
. /tmp/branding/brand.env

FRONT=/app/packages/twenty-server/dist/front
EMAILS=/app/packages/twenty-emails/dist

esc() { printf '%s' "$1" | sed -e 's/[\/&|]/\\&/g'; }
N=$(esc "$BRAND_NAME"); T=$(esc "$BRAND_TAGLINE"); C=$(esc "$BRAND_COMPANY")
W=$(esc "$BRAND_WEBSITE"); D=$(esc "$BRAND_DOCS_URL"); L=$(esc "$BRAND_EMAIL_LOGO_URL"); S=$(esc "$BRAND_SOURCE_URL")
TU=$(esc "$BRAND_TERMS_URL"); PU=$(esc "$BRAND_DPA_URL")

# 1. Icons and logo (generated from branding/logo.png in the build's first stage)
cp -r /tmp/icons/. "$FRONT/images/icons/"

# 1b. The "20" mark used on onboarding/app-connection screens -> our logo, embedded in an SVG
node -e '
  const fs = require("fs");
  const png = fs.readFileSync(process.argv[1]).toString("base64");
  fs.writeFileSync(process.argv[2], `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 192 192" width="192" height="192"><image width="192" height="192" xlink:href="data:image/png;base64,${png}"/></svg>`);
' "/tmp/icons/android/android-launchericon-192-192.png" "$FRONT/images/integrations/twenty-logo.svg"

# 2. Page title, social cards, PWA manifest
sed -i \
  -e "s|<title>Twenty</title>|<title>$N</title>|" \
  -e "s|content=\"Twenty\"|content=\"$N\"|g" \
  -e "s|A modern open-source CRM|$T|g" \
  -e "s|https://raw.githubusercontent.com/twentyhq/twenty/main/docs/static/img/social-card.png|/images/icons/ios/1024.png|g" \
  "$FRONT/index.html"
sed -i -e "s|\"Twenty\"|\"$N\"|g" "$FRONT/manifest.json"

# 3. AGPL section 13: a small "Source code" link on the sign-in pages
node -e '
  const fs = require("fs");
  const f = process.argv[1];
  const snippet = fs.readFileSync("/tmp/branding/source-link.html", "utf8").replace("__SOURCE_URL__", process.argv[2]);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("</body>", snippet + "</body>"));
' "$FRONT/index.html" "$BRAND_SOURCE_URL"

# 3b. Sign-in pages: 50/50 split, SalesKnot panel on the left, Twenty's own form untouched on the right
node -e '
  const fs = require("fs");
  const f = process.argv[1];
  const snippet = fs.readFileSync("/tmp/branding/auth-split.html", "utf8");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("</body>", () => snippet + "</body>"));
' "$FRONT/index.html"

# 4. User-facing text in the web app bundles
find "$FRONT/assets" -name '*.js' -exec sed -i -E \
  -e "s|https://twentyhq.github.io/placeholder-images/workspaces/twenty-logo.png|/images/icons/android/android-launchericon-192-192.png|g" \
  -e "s/\\bTwenty\\b/$N/g" {} +

# 4b. Legal links on the sign-in pages: Terms, DPA and privacy -> ours.
#     Twenty builds terms/privacy as new URL("/terms", "https://twenty.com") via a small locale helper,
#     so replace those helper calls (matched by shape, not by minified name) as well as any literal links.
find "$FRONT/assets" -name '*.js' -exec sed -i -E \
  -e "s|[A-Za-z_\$][A-Za-z0-9_\$]*\([A-Za-z_\$][A-Za-z0-9_\$.]*\.locale,\"terms\"\)|\"$TU\"|g" \
  -e "s|[A-Za-z_\$][A-Za-z0-9_\$]*\([A-Za-z_\$][A-Za-z0-9_\$.]*\.locale,\"privacy-policy\"\)|\"$PU\"|g" \
  -e "s|https://(www\.)?twenty\.com/([a-z]{2}/)?terms[A-Za-z0-9/_-]*|$TU|g" \
  -e "s|https://(www\.)?twenty\.com/([a-z]{2}/)?legal/[A-Za-z0-9/_-]*|$PU|g" \
  -e "s|https://(www\.)?twenty\.com/([a-z]{2}/)?privacy[A-Za-z0-9/_-]*|$PU|g" {} +

# 5. Emails: logo, footer links, company line, product name
find "$EMAILS" \( -name '*.js' -o -name '*.mjs' \) -exec sed -i -E \
  -e "s|https://app.twenty.com/images/icons/windows11/Square150x150Logo.scale-100.png|$L|g" \
  -e "s|https://github.com/twentyhq/twenty\"|$S\"|g" \
  -e "s|https://docs.twenty.com/\"|$D\"|g" \
  -e "s|https://twenty.com/\"|$W\"|g" \
  -e "s/Twenty\\.com, Public Benefit Corporation/$C/g" \
  -e "s/\\bTwenty\\b/$N/g" {} +

echo "Branding applied: $BRAND_NAME"
