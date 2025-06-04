#!/bin/bash

# Build frontend
echo "Building frontend..."
cd src/frontend
npm run build

# Create asset upload script
echo "Creating asset upload script..."
cd ../..

# Function to convert file to hex
file_to_hex() {
    xxd -p "$1" | tr -d '\n'
}

# Function to get MIME type
get_mime_type() {
    case "${1##*.}" in
        html) echo "text/html" ;;
        js) echo "application/javascript" ;;
        css) echo "text/css" ;;
        png) echo "image/png" ;;
        jpg|jpeg) echo "image/jpeg" ;;
        svg) echo "image/svg+xml" ;;
        ico) echo "image/x-icon" ;;
        json) echo "application/json" ;;
        woff) echo "font/woff" ;;
        woff2) echo "font/woff2" ;;
        ttf) echo "font/ttf" ;;
        *) echo "application/octet-stream" ;;
    esac
}

# Create upload script
cat > upload_assets.sh << 'EOF'
#!/bin/bash
CANISTER_ID=$1

if [ -z "$CANISTER_ID" ]; then
    echo "Usage: ./upload_assets.sh <canister_id>"
    exit 1
fi

echo "Uploading assets to canister $CANISTER_ID..."

EOF

# Find all files in dist directory
find src/frontend/dist -type f | while read -r file; do
    # Get relative path from dist directory
    relative_path="${file#src/frontend/dist}"
    # Ensure path starts with /
    if [[ ! "$relative_path" =~ ^/ ]]; then
        relative_path="/$relative_path"
    fi
    
    mime_type=$(get_mime_type "$file")
    
    echo "echo \"Uploading $relative_path...\"" >> upload_assets.sh
    echo "dfx canister call $CANISTER_ID upload_asset '(" >> upload_assets.sh
    echo "  record {" >> upload_assets.sh
    echo "    path = \"$relative_path\";" >> upload_assets.sh
    echo "    content = blob \"\\$(xxd -p \"$file\" | tr -d '\\n')\";" >> upload_assets.sh
    echo "    content_type = \"$mime_type\"" >> upload_assets.sh
    echo "  }" >> upload_assets.sh
    echo ")'" >> upload_assets.sh
    echo "" >> upload_assets.sh
done

chmod +x upload_assets.sh

echo "Build complete! Next steps:"
echo "1. Deploy the integrated canister: dfx deploy integrated"
echo "2. Upload assets: ./upload_assets.sh <canister_id>"