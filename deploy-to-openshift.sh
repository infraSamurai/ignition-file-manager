#!/bin/bash

# Load the transferred image
echo "Loading image..."
docker load < file-manager.tar.gz

# Login to OpenShift
oc login

# Create project
oc new-project file-manager || oc project file-manager

# Tag for internal registry
#docker tag file-manager:latest image-registry.openshift-image-registry.svc:5000/file-manager/file-manager:latest

# Login to internal registry
#podman login -u $(oc whoami) -p $(oc whoami -t) image-registry.openshift-image-registry.svc:5000 --tls-verify=false

# Push to internal registry
#podman push image-registry.openshift-image-registry.svc:5000/file-manager/file-manager:latest --tls-verify=false

# Deploy application
oc apply -f openshift/

# Wait for deployment
oc rollout status deployment/file-manager -n file-manager

# Get route
echo "Application deployed!"
echo "URL: https://$(oc get route file-manager -o jsonpath='{.spec.host}')"