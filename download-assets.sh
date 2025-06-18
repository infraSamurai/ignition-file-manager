#!/bin/bash

# Create assets directory structure
mkdir -p frontend/assets/fontawesome/css
mkdir -p frontend/assets/fontawesome/webfonts

# Download Font Awesome CSS using curl
curl -L https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css \
     -o frontend/assets/fontawesome/css/all.min.css || {
    echo "Failed to download all.min.css"
    exit 1
}

# Download Font Awesome webfonts
FONTS=(
    "fa-brands-400.woff2"
    "fa-regular-400.woff2"
    "fa-solid-900.woff2"
    "fa-v4compatibility.woff2"
)

for font in "${FONTS[@]}"; do
    curl -L "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/$font" \
         -o "frontend/assets/fontawesome/webfonts/$font" || {
        echo "Failed to download $font"
        exit 1
    }
done

echo "Font Awesome assets downloaded successfully!"