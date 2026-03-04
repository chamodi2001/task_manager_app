FROM nginx:1.25-alpine

RUN apk add --no-cache bash

COPY nginx.conf /etc/nginx/templates/default.conf.template

# entrypoint uses envsubst to inject $DOMAIN at runtime
CMD ["/bin/sh", "-c", \
  "envsubst '${DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
