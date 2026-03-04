# ---- Build stage ----
FROM node:18-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# ---- Serve stage ----
FROM nginx:1.25-alpine

COPY --from=build /app/build /usr/share/nginx/html

# 127.0.0.11 is Docker's internal DNS resolver.
# Setting it as the resolver with a short TTL means nginx looks up
# "backend" at request time rather than at startup — so it no longer
# crashes if backend isn't ready when the frontend container starts.
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  \
  resolver 127.0.0.11 valid=5s; \
  set $backend_upstream http://backend:8000; \
  \
  location /api/ { \
    proxy_pass         $backend_upstream; \
    proxy_set_header   Host $host; \
    proxy_set_header   X-Real-IP $remote_addr; \
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for; \
    proxy_set_header   X-Forwarded-Proto $scheme; \
    proxy_read_timeout 90; \
  } \
  \
  location / { \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
