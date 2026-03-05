#!/bin/sh
set -e
trap exit TERM

CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ ! -f "$CERT_PATH" ]; then

    echo "[certbot] Waiting for nginx to be ready on port 80..."
    until curl -sf --max-time 3 "http://nginx/.well-known/acme-challenge/ping" > /dev/null 2>&1 || \
          curl -sf --max-time 3 "http://nginx/" > /dev/null 2>&1; do
        echo "[certbot] nginx not ready yet, retrying in 5s..."
        sleep 5
    done

    echo "[certbot] nginx is up. Requesting certificate for ${DOMAIN}..."
    certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --non-interactive \
        --agree-tos \
        --email "${CERTBOT_EMAIL}" \
        -d "${DOMAIN}" \
        -d "www.${DOMAIN}"

    if [ $? -eq 0 ]; then
        echo "[certbot] Certificate issued successfully."
    else
        echo "[certbot] ERROR: Certificate issuance failed. Check logs above."
    fi

else
    echo "[certbot] Certificate already exists. Skipping issuance."
fi

echo "[certbot] Entering renewal loop (every 12h)..."
while :; do
    sleep 12h & wait $!
    certbot renew --webroot --webroot-path=/var/www/certbot --quiet
done