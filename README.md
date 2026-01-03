# Retro Crypto

A decentralized retro gaming platform that stores classic games on the blockchain. Play DOS, Game Boy, Game Boy Color, and NES games directly in your browser, with games stored immutably on Nimiq or Solana blockchains.

## What is This?

Retro Crypto is a full-stack platform for storing and playing retro games on the blockchain:

- **Web Frontend** - Play games in your browser with integrated emulators
- **Blockchain Storage** - Games stored as chunked data on Nimiq or Solana
- **Multi-Protocol Support** - Switch between Nimiq and Solana protocols
- **Multiple Platforms** - DOS, Game Boy (GB), Game Boy Color (GBC), and NES emulators
- **Developer Tools** - Upload games, manage catalogs, and interact with the blockchain

## Project Structure

```
retro-crypto/
├── web/                    # Main web frontend (Vue 3)
├── nimiq/
│   └── uploader/          # CLI tool for uploading games to Nimiq
├── solana/
│   ├── program/            # Solana on-chain program (Anchor)
│   ├── sdk/                # TypeScript SDK for Solana
│   └── rpc-proxy/          # Rate-limited RPC proxy for Solana
└── games/                  # Game files (if any)
```

## Features

### Supported Game Platforms
- **DOS** - Classic DOS games (via DOSBox)
- **Game Boy** - Original Game Boy games
- **Game Boy Color** - GBC games
- **NES** - Nintendo Entertainment System games

### Supported Blockchains
- **Nimiq** - Native blockchain integration
- **Solana** - Solana program-based storage

### Web Frontend Features
- Multi-protocol support (switch between Nimiq and Solana)
- Game catalog browsing
- Automatic game downloading and caching
- Recently played games
- Developer mode for testing local games
- Keyboard shortcuts (fullscreen, pause, mute, reset)
- Responsive UI with dark theme

## Getting Started

### Web Frontend

The main web application lets you browse and play games stored on the blockchain.

#### Prerequisites
- Node.js 18+ and npm

#### Installation

```bash
cd web
npm install
```

#### Development

```bash
npm run dev
```

Access at `http://localhost:5173`

#### Build for Production

```bash
npm run build
```

Output in `web/dist/` - deploy to any static hosting (GitHub Pages, Netlify, Vercel, etc.)

#### Usage

1. **Select Protocol** - Choose Nimiq or Solana from the header
2. **Configure RPC** - Set your RPC endpoint (or use default)
3. **Select Catalog** - Choose a game catalog to browse
4. **Choose Platform** - Filter by DOS, GB, GBC, or NES
5. **Select Game** - Pick a game from the catalog
6. **Play** - Games auto-download and start playing

#### Developer Mode

Press `Ctrl+Shift+D` to enable developer mode, which allows you to:
- Upload and test local ZIP files before uploading to blockchain
- Test games without blockchain interaction

#### Keyboard Shortcuts

- `F` - Toggle fullscreen
- `R` - Reset game
- `P` - Pause/Resume
- `M` - Mute/Unmute
- `?` - Show help modal

## Uploading Games

### Nimiq Uploader

Upload games to the Nimiq blockchain using the CLI tool.

#### Installation

```bash
cd nimiq/uploader

# One-line install (Linux/macOS)
curl -fsSL https://raw.githubusercontent.com/Maestroi/nimiq-doom/main/uploader/install.sh | bash

# Or from source
make install-user
```

#### Quick Start

1. **Create Account**
   ```bash
   nimiq-uploader account create --global
   ```

2. **Fund Account** - Send NIM to the address shown

3. **Check Balance**
   ```bash
   nimiq-uploader account balance
   ```

4. **Package Game**
   ```bash
   nimiq-uploader package \
     --dir /path/to/game \
     --output game.zip \
     --title "My Game" \
     --platform DOS
   ```

5. **Upload to Blockchain**
   ```bash
   nimiq-uploader upload-cartridge \
     --file game.zip \
     --title "My Game" \
     --semver 1.0.0 \
     --platform 0 \
     --catalog-addr main \
     --generate-cartridge-addr
   ```

#### Platform Codes
- `0` - DOS
- `1` - Game Boy
- `2` - Game Boy Color
- `3` - NES

See [nimiq/uploader/README.md](nimiq/uploader/README.md) for full documentation.

### Solana Program

The Solana program stores games on-chain using chunked storage.

#### Building

```bash
cd solana/program

# Install Anchor CLI
npm install -g @coral-xyz/anchor-cli

# Build
anchor build
```

#### Deploying

```bash
# To devnet
solana config set --url devnet
solana airdrop 5
anchor deploy --provider.cluster devnet

# To localnet
solana-test-validator
anchor deploy --provider.cluster localnet
```

See [solana/program/README.md](solana/program/README.md) for full documentation.

### Solana SDK

TypeScript SDK for interacting with the Solana cartridge storage program.

#### Installation

```bash
cd solana/sdk
npm install
```

#### Usage

```typescript
import { CartridgeClient } from '@solana-retro/sdk';

// Connect to devnet
const client = new CartridgeClient('devnet');

// List cartridges
const { entries } = await client.listCartridges();

// Fetch a cartridge
const cartridge = await client.fetchCartridgeBytes(cartridgeId, {
  onProgress: (progress) => {
    console.log(`Chunks: ${progress.chunksLoaded}/${progress.totalChunks}`);
  }
});

// Publish a cartridge
const result = await client.publishCartridge(keypair, zipBytes, {
  metadata: { title: 'My Game', platform: 'NES' }
});
```

See [solana/sdk/README.md](solana/sdk/README.md) for full API documentation.

### Solana RPC Proxy

Rate-limited RPC proxy for Solana to avoid hitting rate limits when downloading large games.

#### Building

```bash
cd solana/rpc-proxy
go mod tidy
go build -o rpc-proxy .
```

#### Running

```bash
# With per-IP rate limiting (default: 50 req/s per IP)
./rpc-proxy -upstream "https://your-paid-rpc.com"

# Higher limits
./rpc-proxy -upstream "https://your-paid-rpc.com" \
  -ip-rate 100 \
  -ip-burst 300 \
  -wait
```

#### Docker

```bash
docker pull ghcr.io/maestroi/solana-retro-rpc-proxy:latest

docker run -p 8899:8899 \
  -e RPC_UPSTREAM_URL="https://your-paid-rpc.com" \
  ghcr.io/maestroi/solana-retro-rpc-proxy:latest
```

See [solana/rpc-proxy/README.md](solana/rpc-proxy/README.md) for full documentation.

## Game Format

Games must be packaged as ZIP files with a `run.json` manifest:

```json
{
  "title": "Game Title",
  "platform": "DOS",
  "filename": "game.zip",
  "executable": "GAME.EXE"
}
```

### Platform Values
- `"DOS"` - DOS games
- `"GB"` - Game Boy
- `"GBC"` - Game Boy Color
- `"NES"` - NES

## ⚠️ Legal Disclaimer

**IMPORTANT: You are solely responsible for ensuring you have the legal right to upload any content.**

- **Only upload content you own, created yourself, or have explicit permission to distribute**
- **Commercial ROMs (Nintendo, Sega, Atari, etc.) are copyrighted** - uploading them without permission is illegal
- **Blockchain uploads are permanent** - once uploaded, content cannot be removed
- This tool is provided for legitimate use cases only

### What CAN you upload?
✅ Games you created yourself  
✅ Open source / public domain games  
✅ Homebrew games (community-created)  
✅ Freeware / shareware with distribution rights  
✅ Content you have explicit license to distribute  
✅ Abandonware with verified public domain status  

### What should you NOT upload?
❌ Commercial game ROMs you don't have rights to (Nintendo, Sega, Sony, etc.)  
❌ Copyrighted content without permission  
❌ Pirated software  
❌ ROMs downloaded from unauthorized sources  
❌ Commercial games still under copyright protection  

### ROM-Specific Legal Information

**ROMs (Read-Only Memory files)** are digital copies of game cartridges. Most commercial ROMs are protected by copyright law:

- **Nintendo ROMs** - All commercial Nintendo games (NES, Game Boy, SNES, etc.) are copyrighted
- **Sega ROMs** - All commercial Sega games (Genesis, Game Gear, etc.) are copyrighted
- **Other Commercial ROMs** - Virtually all commercial games remain under copyright protection

**Even if you own the original cartridge**, creating and distributing ROMs is generally illegal without explicit permission from the copyright holder.

### Recommended Sources for Legal Games

- [Homebrew Hub](https://hh.gbdev.io/) - Game Boy homebrew games
- [itch.io](https://itch.io/) - Indie games (check individual licenses)
- [DOS Games Archive](https://www.dosgamesarchive.com/) - Freeware DOS games
- [NESdev](https://www.nesdev.org/) - NES homebrew development resources
- [Public Domain ROMs](https://www.pdroms.com/) - Verified public domain games
- Games released to public domain by their creators
- Open source game projects with permissive licenses

**Always verify the license** before uploading any game. When in doubt, don't upload it.  

## Requirements

### Web Frontend
- Node.js 18+
- Modern browser with WebAssembly support

### Nimiq Uploader
- Go 1.21+
- Nimiq RPC endpoint (run your own node recommended)
- Account funded with NIM

### Solana Program
- Rust (latest stable)
- Anchor CLI
- Solana CLI tools

### Solana SDK
- Node.js 18+
- TypeScript 5+

### Solana RPC Proxy
- Go 1.21+

## Architecture

### Storage Format

Games are stored using a chunked storage format:
- **Manifest** - Metadata (size, hash, chunk count, platform)
- **Chunks** - Raw data chunks (typically 51 bytes for Nimiq, 128KB for Solana)
- **Catalog** - Index of available games

### Protocol Drivers

The web frontend uses protocol drivers to abstract blockchain differences:
- `drivers/nimiq.js` - Nimiq blockchain integration
- `drivers/solana.js` - Solana blockchain integration
- `drivers/types.js` - Protocol configuration

### Emulators

Browser-based emulators:
- **DOS** - DOSBox.js
- **Game Boy** - GameBoy.js
- **NES** - JSNES

## Contributing

Contributions welcome! Please ensure:
- Code follows existing style
- Tests pass (where applicable)
- Legal content only (see Legal Disclaimer)

## License

MIT

