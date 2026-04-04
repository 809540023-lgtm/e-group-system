#!/bin/bash
set -e

echo "=== Backend Build Script ==="
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Current directory: $(pwd)"
echo ""

echo "=== Checking package.json ==="
cat package.json
echo ""

echo "=== Installing dependencies ==="
npm install --legacy-peer-deps

echo ""
echo "=== Checking installation ==="
npm list --depth=0

echo ""
echo "=== Build complete ==="
