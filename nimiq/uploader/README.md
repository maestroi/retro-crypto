# Nimiq Uploader

CLI tool for uploading games and files to the Nimiq blockchain using the cartridge format (CART/DATA/CENT).

## ⚠️ Legal Disclaimer

**IMPORTANT: You are solely responsible for ensuring you have the legal right to upload any content.**

- **Only upload content you own, created yourself, or have explicit permission to distribute**
- Commercial ROMs (Nintendo, Sega, etc.) are copyrighted - uploading them without permission is illegal
- **Blockchain uploads are permanent** - once uploaded, content cannot be removed
- This tool is provided for legitimate use cases only

### What CAN you upload?
✅ Games you created yourself  
✅ Open source / public domain games  
✅ Homebrew games (community-created)  
✅ Freeware / shareware with distribution rights  
✅ Content you have explicit license to distribute  

### What should you NOT upload?
❌ Commercial game ROMs you don't have rights to  
❌ Copyrighted content without permission  
❌ Pirated software  

**Recommended sources for legal games:**
- [Homebrew Hub](https://hh.gbdev.io/) - Game Boy homebrew
- [itch.io](https://itch.io/) - Indie games (check licenses)
- [DOS Games Archive](https://www.dosgamesarchive.com/) - Freeware DOS games
- [NESdev](https://www.nesdev.org/) - NES homebrew
- Games released to public domain by their creators

## Installation

### One-Line Install (Linux/macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/Maestroi/nimiq-doom/main/uploader/install.sh | bash
```

This automatically detects your OS/architecture and installs the latest release to `~/bin`.

### From Source (Linux/macOS)

```bash
git clone https://github.com/Maestroi/nimiq-doom.git
cd nimiq-doom/uploader
make install-user
```

### Add to PATH

After installation, add `~/bin` to your PATH (if not already):

```bash
# For zsh (macOS default)
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# For bash (Linux default)
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### System-wide Install

```bash
# Install to /usr/local/bin (requires sudo)
sudo make install
```

### Manual Build

```bash
# Just build (creates ./nimiq-uploader)
make build

# Or with Go directly
go build -o nimiq-uploader .
```

### Verify Installation

```bash
nimiq-uploader version
nimiq-uploader config
```

## RPC Configuration

The uploader needs a Nimiq RPC endpoint to communicate with the blockchain. **You should run your own Nimiq node** for uploading.

### RPC URL Priority (highest to lowest)

1. `--rpc-url` flag on command line
2. `NIMIQ_RPC_URL` environment variable
3. `RPC_URL` in credentials file
4. Default: `http://localhost:8648`

### Setting Up RPC

**Option 1: Run your own Nimiq node (recommended)**
```bash
# See https://github.com/nimiq/core-rs-albatross for setup
# Default RPC port is 8648
```

**Option 2: Set in credentials file**
```json
// Edit ~/.config/nimiq-uploader/credentials.json
{
  "address": "NQ00 ...",
  "rpc_url": "http://your-node-ip:8648"
}
```

**Option 3: Environment variable**
```bash
export NIMIQ_RPC_URL="http://your-node-ip:8648"
```

**Option 4: Per-command flag**
```bash
nimiq-uploader account balance --rpc-url http://your-node-ip:8648
```

## Quick Start

### 1. Create Account

```bash
# Save credentials globally (~/.config/nimiq-uploader/)
nimiq-uploader account create --global

# Or save locally (./credentials.json)
nimiq-uploader account create
```

### 2. Configure RPC (if not localhost)

Edit `~/.config/nimiq-uploader/credentials.json` and set:
```json
{
  "rpc_url": "http://your-nimiq-node:8648"
}
```

### 3. Fund the Address

Send some NIM to the address shown (mainnet).

### 4. Check Balance

```bash
nimiq-uploader account balance
```

### 5. Upload a Game

```bash
# Package your game first
nimiq-uploader package --dir /path/to/game --output game.zip --title "My Game" --platform DOS

# Upload to blockchain
nimiq-uploader upload-cartridge \
  --file game.zip \
  --title "My Game" \
  --semver 1.0.0 \
  --platform 0 \
  --catalog-addr main \
  --generate-cartridge-addr
```

## Commands

### Main Commands

| Command | Description |
|---------|-------------|
| `upload-cartridge` | Upload a file using CART/DATA/CENT format |
| `account` | Manage Nimiq accounts |
| `package` | Package game files into a ZIP |
| `retire-app` | Mark an app as retired in the catalog |
| `config` | Show configuration paths and current settings |
| `version` | Show version information |

### Account Subcommands

| Command | Description |
|---------|-------------|
| `account create` | Create a new account |
| `account create --global` | Create account and save to global config |
| `account import` | Import an account by private key |
| `account status` | Check account status |
| `account balance` | Check account balance |
| `account unlock` | Unlock an account |
| `account lock` | Lock an account |
| `account wait-funds` | Wait until account has minimum balance |
| `account consensus` | Check if node has consensus |

### Utility Commands

| Command | Description |
|---------|-------------|
| `migrate` | Convert legacy txt credentials to JSON format |
| `migrate --global` | Migrate and save to global config |

## Configuration

### Config Locations

Credentials are loaded from (in order):
1. `./credentials.json` (current directory)
2. `~/.config/nimiq-uploader/credentials.json` (global config)
3. `./account_credentials.txt` (legacy, current directory)
4. `~/.config/nimiq-uploader/account_credentials.txt` (legacy, global)

### View Current Configuration

```bash
nimiq-uploader config
```

### Credentials File Format (JSON)

```json
{
  "address": "NQ00 XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX",
  "public_key": "...",
  "private_key": "...",
  "passphrase": "...",
  "rpc_url": "http://localhost:8648",
  "created_at": "2026-01-02T12:00:00Z",
  "comment": "Optional description"
}
```

⚠️ **Keep this file secure!** It contains your private key.

### Migrating from Legacy Format

If you have an old `account_credentials.txt` file, convert it to JSON:

```bash
# Migrate and save globally
nimiq-uploader migrate --global

# Or migrate to current directory
nimiq-uploader migrate
```

### Load Credentials into Shell

```bash
source load-credentials.sh
```

This sets environment variables: `ADDRESS`, `PRIVATE_KEY`, `PASSPHRASE`, `NIMIQ_RPC_URL`

## Upload Examples

### Upload a DOS Game

```bash
nimiq-uploader upload-cartridge \
  --file doom.zip \
  --title "DOOM" \
  --semver 1.0.0 \
  --platform 0 \
  --catalog-addr main \
  --generate-cartridge-addr \
  --concurrency 5 \
  --rate 25
```

### Upload a New Version

```bash
nimiq-uploader upload-cartridge \
  --file doom-v2.zip \
  --title "DOOM" \
  --semver 1.1.0 \
  --platform 0 \
  --catalog-addr main \
  --generate-cartridge-addr
```

The tool automatically finds the existing app-id for the title.

### Dry Run (Test Without Sending)

```bash
nimiq-uploader upload-cartridge \
  --file game.zip \
  --title "Test Game" \
  --semver 1.0.0 \
  --catalog-addr test \
  --generate-cartridge-addr \
  --dry-run
```

## Reference

### Platform Codes

| Code | Platform |
|------|----------|
| 0 | DOS |
| 1 | Game Boy |
| 2 | Game Boy Color |
| 3 | NES |

### Catalog Addresses

| Shortcut | Address |
|----------|---------|
| `main` | NQ15 NXMP 11A0 TMKP G1Q8 4ABD U16C XD6Q D948 |
| `test` | NQ32 0VD4 26TR 1394 KXBJ 862C NFKG 61M5 GFJ0 |

### Progress and Resumption

Upload progress is saved to `upload_cartridge_<app_id>_<cartridge_id>.json`. If interrupted, run the same command again to resume.

## Makefile Targets

```bash
make              # Build
make build        # Build
make build-all    # Build for linux/darwin amd64/arm64
make install      # Install to /usr/local/bin (needs sudo)
make install-user # Install to ~/bin (no sudo)
make config       # Set up config directory
make uninstall    # Remove installed binary
make clean        # Clean build artifacts
make help         # Show help
```

## Requirements

- Go 1.21+
- Nimiq RPC endpoint (run your own node)
- Account funded with NIM

## Troubleshooting

### "command not found: nimiq-uploader"

Add `~/bin` to your PATH:
```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### "failed to check consensus" or connection errors

Make sure your Nimiq node is running and accessible:
```bash
curl http://localhost:8648 -d '{"jsonrpc":"2.0","method":"consensus","id":1}'
```

### "account is locked"

Unlock your account before sending transactions:
```bash
nimiq-uploader account unlock --passphrase "your-passphrase"
```

## Web Frontend

The web frontend is in the `web/` directory. It's a Vue 3 app that connects directly to Nimiq RPC endpoints.

### Running the Web Frontend

```bash
cd web
npm install
npm run dev
```

Access at `http://localhost:5173`

### Running with Docker

```bash
# From project root
docker compose up -d
```

Access at `http://localhost:5174`

### Building for Production

```bash
cd web
npm run build
# Output in web/dist/
```

The built files can be deployed to any static hosting (GitHub Pages, Netlify, Vercel, etc.).

**Live Demo:** https://maestroi.github.io/nimiq-doom/

See the main [README.md](../README.md) for full documentation on the web frontend and emulator integration.

## Legacy Commands

The following commands are deprecated but kept for backwards compatibility:

- `upload` - Old DOOM format upload (use `upload-cartridge` instead)
- `manifest` - Old manifest generation (not needed with cartridge format)
