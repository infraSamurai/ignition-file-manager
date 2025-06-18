#!/bin/bash

# Fix missing passwd entry for arbitrary UID (used in OpenShift)
if ! whoami &> /dev/null; then
  echo "default:x:$(id -u):0:default user:/home:/sbin/nologin" >> /etc/passwd
fi

# Create htpasswd file
ADMIN_USER=${ADMIN_USER:-admin}
ADMIN_PASS=${ADMIN_PASS:-admin123}

# Ensure directories exist
mkdir -p /tmp/nginx/{client_body,proxy,fastcgi,uwsgi,scgi}

# Create htpasswd file in temp location
htpasswd -bc /tmp/.htpasswd "$ADMIN_USER" "$ADMIN_PASS"

echo "Starting File Manager..."
echo "Username: $ADMIN_USER"

# Start Flask app in background
cd /app
python3 backend/app.py &

# Wait for Flask to start
sleep 3

# Start nginx in foreground
nginx -g 'daemon off;'