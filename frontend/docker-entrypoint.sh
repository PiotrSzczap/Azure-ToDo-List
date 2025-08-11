#!/bin/sh
set -euo pipefail

HTML_DIR=/usr/share/nginx/html
NGINX_CONF=/etc/nginx/conf.d/default.conf

# Decide upstream: explicit API_BASE_URL or internal backend service
if [ -n "${API_BASE_URL:-}" ]; then
  API_UPSTREAM="$API_BASE_URL"
else
  API_UPSTREAM="http://backend:8080"
fi

echo "[entrypoint] Using API upstream: $API_UPSTREAM" >&2

# Write runtime config consumed by Angular app
cat > "$HTML_DIR/config.json" <<EOF
{ "apiBaseUrl": "${API_UPSTREAM}" }
EOF

# Generate nginx config (no fragile envsubst needed)
cat > "$NGINX_CONF" <<EOF
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Docker internal DNS resolver so nginx can resolve service names when using a variable in proxy_pass
  resolver 127.0.0.11 ipv6=off valid=30s;
  set \$api_upstream ${API_UPSTREAM};

  location /config.json {
    add_header Cache-Control "no-store";
    try_files /config.json =404;
  }

  location /api/ {
    # Pass full original URI (including /api/...) to upstream without path rewriting
    proxy_pass \$api_upstream;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

exec "$@"
