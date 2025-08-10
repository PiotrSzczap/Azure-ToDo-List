#!/bin/sh
set -e
HTML_DIR=/usr/share/nginx/html
# Inject runtime config.json
cat > $HTML_DIR/config.json <<EOF
{ "apiBaseUrl": "${API_BASE_URL}" }
EOF
# Render nginx template (envsubst expands variables if present)
if [ -f /etc/nginx/templates/default.conf.template ]; then
  envsubst '$API_BASE_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
fi
exec "$@"
