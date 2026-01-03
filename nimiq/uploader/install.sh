#!/bin/bash
# Nimiq Uploader Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/Maestroi/nimiq-doom/main/uploader/install.sh | bash

set -e

REPO="Maestroi/nimiq-doom"
BINARY_NAME="nimiq-uploader"
INSTALL_DIR="${INSTALL_DIR:-$HOME/bin}"

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
    x86_64)
        ARCH="amd64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

case "$OS" in
    linux|darwin)
        ;;
    *)
        echo "❌ Unsupported OS: $OS"
        exit 1
        ;;
esac

PLATFORM="${OS}-${ARCH}"

echo "🔍 Detecting system: $PLATFORM"

# Get latest release version
echo "📦 Fetching latest release..."
LATEST_RELEASE=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_RELEASE" ]; then
    echo "❌ Failed to fetch latest release. Using 'latest' tag..."
    LATEST_RELEASE="latest"
fi

echo "📥 Downloading ${BINARY_NAME} ${LATEST_RELEASE} for ${PLATFORM}..."

# Download URL
DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_RELEASE}/${BINARY_NAME}-${PLATFORM}"

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Download binary
TEMP_FILE=$(mktemp)
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TEMP_FILE"; then
    echo "❌ Failed to download from: $DOWNLOAD_URL"
    echo ""
    echo "The release may not exist yet. You can build from source instead:"
    echo "  git clone https://github.com/${REPO}.git"
    echo "  cd nimiq-doom/uploader"
    echo "  make install-user"
    rm -f "$TEMP_FILE"
    exit 1
fi

# Make executable and move to install directory
chmod +x "$TEMP_FILE"
mv "$TEMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"

echo "✅ Installed ${BINARY_NAME} to ${INSTALL_DIR}/${BINARY_NAME}"

# Check if install dir is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "⚠️  ${INSTALL_DIR} is not in your PATH."
    echo ""
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
        zsh)
            RC_FILE="~/.zshrc"
            ;;
        bash)
            RC_FILE="~/.bashrc"
            ;;
        *)
            RC_FILE="your shell config"
            ;;
    esac
    echo "Add it to your PATH by running:"
    echo "  echo 'export PATH=\"\$HOME/bin:\$PATH\"' >> $RC_FILE"
    echo "  source $RC_FILE"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Get started:"
echo "  ${BINARY_NAME} --help"
echo "  ${BINARY_NAME} account create --global"
echo ""

