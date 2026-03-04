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

# Serve React app + proxy /api/ to Django backend.
# Locally:      frontend nginx on :3000 proxies /api/ → backend:8000
# Production:   main nginx handles /api/ before it reaches here
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  \
  location /api/ { \
    proxy_pass         http://backend:8000; \
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