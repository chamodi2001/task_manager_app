#!/bin/sh
set -e

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
HTTPS_TEMPLATE="/etc/nginx/templates/nginx.https.conf.template"
HTTP_TEMPLATE="/etc/nginx/templates/nginx.http.conf.template"
CONF="/etc/nginx/conf.d/default.conf"

if [ -f "$CERT_PATH" ]; then
    # ── Certs already exist (all deploys after the first) ──────────
    echo "[nginx] SSL certificate found. Starting with HTTPS config."
    envsubst '${DOMAIN}' < "$HTTPS_TEMPLATE" > "$CONF"
    exec nginx -g "daemon off;"
else
    # ── First boot — no cert yet ────────────────────────────────────
    echo "[nginx] No SSL certificate found. Starting HTTP-only for ACME challenge."
    envsubst '${DOMAIN}' < "$HTTP_TEMPLATE" > "$CONF"

    # Start nginx in the background so certbot can reach port 80
    nginx -g "daemon off;" &
    NGINX_PID=$!

    echo "[nginx] Waiting for certbot to issue certificate at: $CERT_PATH"
    # Poll every 5 seconds — certbot container will create the cert
    while [ ! -f "$CERT_PATH" ]; do
        sleep 5
        echo "[nginx] Still waiting for certificate..."
    done

    echo "[nginx] Certificate issued! Switching to HTTPS config."
    envsubst '${DOMAIN}' < "$HTTPS_TEMPLATE" > "$CONF"
    nginx -s reload

    echo "[nginx] Now serving HTTPS."
    # Keep the foreground process alive
    wait $NGINX_PID
fi
