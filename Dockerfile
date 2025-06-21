
# Multi-stage build for disconnected environment
FROM python:3.10-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create wheels directory
RUN mkdir /wheels

# Copy and install Python dependencies to wheels
COPY backend/requirements.txt /tmp/
RUN pip wheel --no-cache-dir --wheel-dir /wheels -r /tmp/requirements.txt

# Download Font Awesome assets
RUN mkdir -p /assets/fontawesome/css /assets/fontawesome/webfonts && \
    wget -q https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css \
         -O /assets/fontawesome/css/all.min.css && \
    for font in fa-brands-400.woff2 fa-regular-400.woff2 fa-solid-900.woff2 fa-v4compatibility.woff2; do \
        wget -q "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/$font" \
             -O "/assets/fontawesome/webfonts/$font"; \
    done

# Final stage
FROM python:3.10-slim

# Install nginx and apache2-utils
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    nginx \
    apache2-utils \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy wheels from builder
COPY --from=builder /wheels /wheels

# Install Python packages from wheels
RUN pip install --no-cache-dir --no-index --find-links /wheels /wheels/*.whl && \
    rm -rf /wheels

WORKDIR /app

# Copy application files
COPY backend /app/backend
COPY frontend /var/www/html

# Copy Font Awesome assets from builder
COPY --from=builder /assets/fontawesome /var/www/html/assets/fontawesome


# Configure nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create upload directory with proper permissions
RUN mkdir -p /mnt/file && chmod 777 /mnt/file

# Create non-root user for OpenShift
RUN useradd -u 1001 -g 0 -M -s /sbin/nologin appuser && \
    chown -R 1001:0 /app /var/www/html /mnt/file /etc/nginx /var/log/nginx /var/lib/nginx && \
    chmod -R g=u /app /var/www/html /mnt/file /etc/nginx /var/log/nginx /var/lib/nginx

# OpenShift runs containers with random UID
RUN chmod g+w /etc/passwd && \
    chmod -R g+rwX /var/log/nginx /var/lib/nginx /run && \
    mkdir -p /var/cache/nginx && \
    chmod -R g+rwX /var/cache/nginx

# Create required nginx temp directories
RUN mkdir -p /tmp/nginx/{client_body,proxy,fastcgi,uwsgi,scgi} && \
    chmod -R 777 /tmp/nginx

EXPOSE 8080

USER 1001

CMD ["/entrypoint.sh"]
