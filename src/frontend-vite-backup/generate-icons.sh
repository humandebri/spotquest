#!/bin/bash

# This script generates PWA icons from the SVG icon
# Requires ImageMagick to be installed: brew install imagemagick

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is required but not installed."
    echo "Install it with: brew install imagemagick"
    exit 1
fi

# Navigate to public directory
cd public

# Generate PNG icons from SVG
echo "Generating PWA icons..."

# 192x192 icon
convert -background none -resize 192x192 icon.svg icon-192.png
echo "✓ Generated icon-192.png"

# 512x512 icon
convert -background none -resize 512x512 icon.svg icon-512.png
echo "✓ Generated icon-512.png"

# Generate a simple screenshot
convert -size 1280x720 xc:'#1a1a2e' \
  -gravity center \
  -pointsize 72 \
  -fill '#3282b8' \
  -annotate +0-100 'Guess the Spot' \
  -pointsize 36 \
  -fill '#0f4c75' \
  -annotate +0+0 '写真から場所を当てるWeb3ゲーム' \
  screenshot-1.png
echo "✓ Generated screenshot-1.png"

echo "All icons generated successfully!"