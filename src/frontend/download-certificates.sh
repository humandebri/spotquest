#!/bin/bash

echo "Downloading iOS certificates from EAS..."

# Create a temporary directory for certificates
mkdir -p ./ios-certs

# Download the distribution certificate and provisioning profile
echo "This script will help you download certificates from EAS."
echo "You'll need to run the following commands manually:"
echo ""
echo "1. First, download the distribution certificate:"
echo "   eas credentials -p ios"
echo "   - Select 'Download Distribution Certificate'"
echo "   - Save as ./ios-certs/dist-cert.p12"
echo ""
echo "2. Download the provisioning profile:"
echo "   eas credentials -p ios" 
echo "   - Select 'Download Provisioning Profile'"
echo "   - Save as ./ios-certs/profile.mobileprovision"
echo ""
echo "3. Import the certificate to your keychain:"
echo "   security import ./ios-certs/dist-cert.p12 -P [password]"
echo ""
echo "4. Install the provisioning profile:"
echo "   cp ./ios-certs/profile.mobileprovision ~/Library/MobileDevice/Provisioning\\ Profiles/"
echo ""
echo "After completing these steps, run:"
echo "   eas build --profile local-dev --platform ios --local"