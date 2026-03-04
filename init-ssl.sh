#!/bin/bash
# init-ssl.sh
# Run ONCE on your EC2 instance to issue the first Let's Encrypt certificate.
# Usage: bash init-ssl.sh

set -e

if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
  exit 1
fi

if [ -z "$DOMAIN" ] || [ -z "$CERTBOT_EMAIL" ]; then
  echo "ERROR: Set DOMAIN and CERTBOT_EMAIL in your .env file."
  exit 1
fi

echo ">>> Step 1: Start nginx in HTTP-only mode (for ACME challenge)"
# Temporarily replace SSL config with HTTP-only so nginx can start without certs
docker compose up -d nginx

echo ">>> Step 2: Request certificate from Let's Encrypt"
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo ">>> Step 3: Reload nginx with SSL config"
docker compose restart nginx

echo ">>> Done! SSL certificate issued for $DOMAIN"
echo "    Certbot will auto-renew every 12 hours."
