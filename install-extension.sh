#!/bin/bash

# Step 1: Package the extension as .xpi
cd "/home/devanshu/TimeStream /firefox-extension"
zip -r "../timestream-extension.xpi" .
cd ..

# Step 2: Create Firefox policy folder
sudo mkdir -p /usr/lib/firefox/distribution

# Step 3: Write the policy file
sudo tee /usr/lib/firefox/distribution/policies.json << 'POLICY'
{
  "policies": {
    "Extensions": {
      "Install": [
        "file:///home/devanshu/TimeStream /timestream-extension.xpi"
      ]
    }
  }
}
POLICY

echo "Done! Restart Firefox to install the extension permanently."
