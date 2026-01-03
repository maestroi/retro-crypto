#!/bin/bash
# Load account credentials from file and set environment variables
# Searches for credentials in:
# 1. Specified file path (if provided)
# 2. ./credentials.json (current directory, JSON)
# 3. ~/.config/nimiq-uploader/credentials.json (global config, JSON)
# 4. ./account_credentials.txt (legacy, current directory)
# 5. ~/.config/nimiq-uploader/account_credentials.txt (legacy, global)

CREDENTIALS_FILE="${1:-}"
IS_JSON=false

# If no file specified, search in order
if [ -z "$CREDENTIALS_FILE" ]; then
    if [ -f "credentials.json" ]; then
        CREDENTIALS_FILE="credentials.json"
        IS_JSON=true
    elif [ -f "$HOME/.config/nimiq-uploader/credentials.json" ]; then
        CREDENTIALS_FILE="$HOME/.config/nimiq-uploader/credentials.json"
        IS_JSON=true
    elif [ -f "account_credentials.txt" ]; then
        CREDENTIALS_FILE="account_credentials.txt"
    elif [ -f "$HOME/.config/nimiq-uploader/account_credentials.txt" ]; then
        CREDENTIALS_FILE="$HOME/.config/nimiq-uploader/account_credentials.txt"
    else
        echo "Error: Credentials file not found"
        echo "Searched: ./credentials.json"
        echo "         ~/.config/nimiq-uploader/credentials.json"
        echo "         ./account_credentials.txt"
        echo "         ~/.config/nimiq-uploader/account_credentials.txt"
        echo ""
        echo "Usage: source load-credentials.sh [credentials_file]"
        echo "Or run: nimiq-uploader account create --global"
        return 1 2>/dev/null || exit 1
    fi
fi

if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "Error: Credentials file not found: $CREDENTIALS_FILE"
    echo "Usage: source load-credentials.sh [credentials_file]"
    return 1 2>/dev/null || exit 1
fi

# Check if JSON by extension or content
if [[ "$CREDENTIALS_FILE" == *.json ]]; then
    IS_JSON=true
elif head -1 "$CREDENTIALS_FILE" | grep -q '^{'; then
    IS_JSON=true
fi

# Extract values from the file
if [ "$IS_JSON" = true ]; then
    # JSON format - requires jq or Python
    if command -v jq &> /dev/null; then
        export ADDRESS=$(jq -r '.address // empty' "$CREDENTIALS_FILE")
        export PRIVATE_KEY=$(jq -r '.private_key // empty' "$CREDENTIALS_FILE")
        export PASSPHRASE=$(jq -r '.passphrase // empty' "$CREDENTIALS_FILE")
        export RPC_URL=$(jq -r '.rpc_url // empty' "$CREDENTIALS_FILE")
        export PUBLIC_KEY=$(jq -r '.public_key // empty' "$CREDENTIALS_FILE")
    elif command -v python3 &> /dev/null; then
        export ADDRESS=$(python3 -c "import json; d=json.load(open('$CREDENTIALS_FILE')); print(d.get('address',''))")
        export PRIVATE_KEY=$(python3 -c "import json; d=json.load(open('$CREDENTIALS_FILE')); print(d.get('private_key',''))")
        export PASSPHRASE=$(python3 -c "import json; d=json.load(open('$CREDENTIALS_FILE')); print(d.get('passphrase',''))")
        export RPC_URL=$(python3 -c "import json; d=json.load(open('$CREDENTIALS_FILE')); print(d.get('rpc_url',''))")
        export PUBLIC_KEY=$(python3 -c "import json; d=json.load(open('$CREDENTIALS_FILE')); print(d.get('public_key',''))")
    else
        echo "Error: JSON credentials require 'jq' or 'python3' to parse"
        echo "Install jq: brew install jq (macOS) or apt install jq (Linux)"
        return 1 2>/dev/null || exit 1
    fi
else
    # Legacy txt format
    export ADDRESS=$(grep "^ADDRESS=" "$CREDENTIALS_FILE" | cut -d'=' -f2)
    export PRIVATE_KEY=$(grep "^PRIVATE_KEY=" "$CREDENTIALS_FILE" | cut -d'=' -f2)
    export PASSPHRASE=$(grep "^PASSPHRASE=" "$CREDENTIALS_FILE" | cut -d'=' -f2)
    export RPC_URL=$(grep "^RPC_URL=" "$CREDENTIALS_FILE" | cut -d'=' -f2)
    export PUBLIC_KEY=$(grep "^PUBLIC_KEY=" "$CREDENTIALS_FILE" | cut -d'=' -f2)
fi

# Set NIMIQ_RPC_URL for the uploader CLI
if [ -n "$RPC_URL" ]; then
    export NIMIQ_RPC_URL="$RPC_URL"
fi

if [ -z "$ADDRESS" ] || [ -z "$PRIVATE_KEY" ] || [ -z "$PASSPHRASE" ]; then
    echo "Error: Invalid credentials file format"
    return 1 2>/dev/null || exit 1
fi

echo "✅ Credentials loaded from $CREDENTIALS_FILE"
echo "   Address: $ADDRESS"
echo "   RPC URL: ${RPC_URL:-http://localhost:8648 (default)}"
echo ""
echo "Environment variables set:"
echo "   ADDRESS, PRIVATE_KEY, PASSPHRASE, NIMIQ_RPC_URL, PUBLIC_KEY"
echo ""
echo "You can now use:"
echo "   nimiq-uploader account unlock --passphrase \"\$PASSPHRASE\""
echo "   nimiq-uploader account balance"
echo "   nimiq-uploader account wait-funds"
