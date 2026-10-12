# SalesKnot: Twenty CRM with OpsKnot branding.
# Bump TWENTY_VERSION to upgrade; branding is re-applied automatically.
ARG TWENTY_VERSION=v2.46.0

FROM twentycrm/twenty:${TWENTY_VERSION} AS upstream

# Stage 1: resize branding/logo.png into every icon size Twenty ships
FROM alpine:3.20 AS icons
RUN apk add --no-cache imagemagick
COPY --from=upstream /app/packages/twenty-server/dist/front/images/icons /icons
COPY branding/logo.png /logo.png
RUN find /icons -name '*.png' | while read -r f; do \
      size=$(magick identify -format '%wx%h' "$f"); \
      magick /logo.png -background none -resize "$size" -gravity center -extent "$size" "$f"; \
    done

# Stage 2: the branded image
FROM upstream
USER root
COPY branding /tmp/branding
COPY --from=icons /icons /tmp/icons
RUN sh /tmp/branding/apply-branding.sh && rm -rf /tmp/branding /tmp/icons
USER 1000
LABEL org.opencontainers.image.title="SalesKnot" \
      org.opencontainers.image.description="SalesKnot CRM by OpsKnot, built on Twenty (AGPL-3.0)"
