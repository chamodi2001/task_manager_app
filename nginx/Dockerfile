FROM nginx:1.25-alpine

RUN apk add --no-cache bash

# Both config templates — entrypoint picks the right one at runtime
COPY nginx.http.conf  /etc/nginx/templates/nginx.http.conf.template
COPY nginx.https.conf /etc/nginx/templates/nginx.https.conf.template

# Startup script — handles first boot (HTTP only) and subsequent boots (HTTPS)
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
