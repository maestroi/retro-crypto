# Nimiq Uploader Makefile
# Supports Linux and macOS

BINARY_NAME=nimiq-uploader
VERSION?=1.0.0
BUILD_TIME=$(shell date -u +%Y-%m-%dT%H:%M:%SZ)

# Installation directories
PREFIX?=/usr/local
BINDIR=$(PREFIX)/bin
CONFIG_DIR=$(HOME)/.config/nimiq-uploader

# Go build flags
LDFLAGS=-ldflags "-X main.Version=$(VERSION) -X main.BuildTime=$(BUILD_TIME)"

# Detect OS
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Linux)
    OS=linux
endif
ifeq ($(UNAME_S),Darwin)
    OS=darwin
endif

.PHONY: all build clean install uninstall config help test

all: build

# Build the binary
build:
	@echo "Building $(BINARY_NAME) for $(OS)..."
	go build $(LDFLAGS) -o $(BINARY_NAME) .
	@echo "✅ Build complete: ./$(BINARY_NAME)"

# Build for multiple platforms
build-all:
	@echo "Building for multiple platforms..."
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BINARY_NAME)-linux-amd64 .
	GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o $(BINARY_NAME)-linux-arm64 .
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(BINARY_NAME)-darwin-amd64 .
	GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o $(BINARY_NAME)-darwin-arm64 .
	@echo "✅ Built binaries for linux-amd64, linux-arm64, darwin-amd64, darwin-arm64"

# Install to system (requires sudo on Linux, may require sudo on macOS)
install: build config
	@echo "Installing $(BINARY_NAME) to $(BINDIR)..."
	@mkdir -p $(BINDIR)
	@cp $(BINARY_NAME) $(BINDIR)/$(BINARY_NAME)
	@chmod +x $(BINDIR)/$(BINARY_NAME)
	@echo "✅ Installed to $(BINDIR)/$(BINARY_NAME)"
	@echo ""
	@echo "You can now run '$(BINARY_NAME)' from anywhere!"
	@echo "Config directory: $(CONFIG_DIR)"

# Install for current user only (no sudo needed)
install-user: build config
	@echo "Installing $(BINARY_NAME) to ~/bin..."
	@mkdir -p $(HOME)/bin
	@cp $(BINARY_NAME) $(HOME)/bin/$(BINARY_NAME)
	@chmod +x $(HOME)/bin/$(BINARY_NAME)
	@echo "✅ Installed to $(HOME)/bin/$(BINARY_NAME)"
	@echo ""
	@echo "Make sure ~/bin is in your PATH:"
	@echo "  export PATH=\"\$$HOME/bin:\$$PATH\""
	@echo ""
	@echo "Add this to your ~/.bashrc or ~/.zshrc for permanent access."

# Create config directory and copy credentials if they exist
config:
	@echo "Setting up config directory..."
	@mkdir -p $(CONFIG_DIR)
	@if [ -f account_credentials.txt ]; then \
		echo "Copying account_credentials.txt to $(CONFIG_DIR)/"; \
		cp account_credentials.txt $(CONFIG_DIR)/; \
		chmod 600 $(CONFIG_DIR)/account_credentials.txt; \
	fi
	@echo "✅ Config directory ready: $(CONFIG_DIR)"

# Uninstall
uninstall:
	@echo "Removing $(BINARY_NAME) from $(BINDIR)..."
	@rm -f $(BINDIR)/$(BINARY_NAME)
	@rm -f $(HOME)/bin/$(BINARY_NAME)
	@echo "✅ Uninstalled"
	@echo ""
	@echo "Note: Config directory $(CONFIG_DIR) was NOT removed."
	@echo "Run 'make clean-config' to remove it."

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -f $(BINARY_NAME)
	@rm -f $(BINARY_NAME)-*
	@rm -f upload_progress_*.json
	@rm -f upload_cartridge_*.json
	@rm -f upload_plan.jsonl
	@echo "✅ Cleaned"

# Clean config (use with caution!)
clean-config:
	@echo "⚠️  This will remove your credentials!"
	@echo "Config directory: $(CONFIG_DIR)"
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ] && rm -rf $(CONFIG_DIR) && echo "✅ Config removed" || echo "Cancelled"

# Run tests
test:
	go test -v ./...

# Show help
help:
	@echo "Nimiq Uploader Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make              Build the binary"
	@echo "  make build        Build the binary"
	@echo "  make build-all    Build for multiple platforms"
	@echo "  make install      Install to $(BINDIR) (may need sudo)"
	@echo "  make install-user Install to ~/bin (no sudo needed)"
	@echo "  make config       Set up config directory"
	@echo "  make uninstall    Remove installed binary"
	@echo "  make clean        Clean build artifacts"
	@echo "  make clean-config Remove config directory (credentials)"
	@echo "  make test         Run tests"
	@echo "  make help         Show this help"
	@echo ""
	@echo "After installation, run:"
	@echo "  $(BINARY_NAME) --help"
	@echo ""
	@echo "Config directory: $(CONFIG_DIR)"
	@echo "  - account_credentials.txt will be stored there"

