#!/bin/bash

# Configuration
IMAGE_NAME="file-manager"
PROJECT="file-manager"

echo "=== File Manager Build for Disconnected Deployment (Mac) ==="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Step 1: Download Font Awesome assets
echo "1. Downloading Font Awesome assets..."
bash download-assets-mac.sh

# Step 2: Build image
echo "2. Building Docker image..."
docker build -t ${IMAGE_NAME}:latest .

# Step 3: Save image for transfer
echo "3. Saving image for transfer..."
docker save ${IMAGE_NAME}:latest | gzip > ${IMAGE_NAME}.tar.gz

# Calculate file size
SIZE=$(du -h ${IMAGE_NAME}.tar.gz | cut -f1)
echo "=== Build Complete ==="
echo "Image saved as: ${IMAGE_NAME}.tar.gz (${SIZE})"
echo ""
echo "Next steps:"
echo "1. Transfer ${IMAGE_NAME}.tar.gz to your bastion host"
echo "   scp ${IMAGE_NAME}.tar.gz user@bastion:/path/to/destination/"
echo ""
echo "2. On bastion host, run:"
echo "   docker load < ${IMAGE_NAME}.tar.gz"
echo "   oc login"
echo "   bash deploy-to-openshift.sh"