# Retro Crypto

A decentralized retro gaming platform that stores classic games on the blockchain. Play DOS, Game Boy, Game Boy Color, and NES games directly in your browser, with games stored immutably on Nimiq, Solana, or Sui blockchains.

## 🎮 Live Demo

**Try it now:** [https://maestroi.github.io/retro-crypto/](https://maestroi.github.io/retro-crypto/)

## What is This?

Retro Crypto is a full-stack platform for storing and playing retro games on the blockchain:

- **Web Frontend** - Play games in your browser with integrated emulators
- **Blockchain Storage** - Games stored as chunked data on Nimiq, Solana, or Sui (with Walrus blob storage)
- **Multi-Protocol Support** - Switch between Nimiq, Solana, and Sui protocols
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
├── sui/
│   ├── contracts/          # Sui Move contracts (catalog, cartridge, registry)
│   ├── cmd/catalogctl/     # CLI tool for managing Sui catalogs
│   └── internal/           # Internal Go packages (Sui client, Walrus client)
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
- **Sui** - Sui Move contracts with Walrus decentralized blob storage

### Web Frontend Features
- Multi-protocol support (switch between Nimiq, Solana, and Sui)
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

1. **Select Protocol** - Choose Nimiq, Solana, or Sui from the header
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

### Sui + Walrus

Sui blockchain integration with Walrus decentralized blob storage. Games are stored as blobs on Walrus with metadata on Sui.

#### Prerequisites

1. **Install Sui CLI**
   ```bash
   # macOS
   brew install sui
   
   # Or from source
   cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
   ```

2. **Get Testnet SUI Tokens**
   ```bash
   sui client new-address ed25519
   sui client faucet
   ```

#### Building catalogctl

```bash
cd sui
go build -o catalogctl ./cmd/catalogctl
```

#### Quick Start

1. **Deploy Move Contracts**
   ```bash
   cd sui/contracts
   sui client publish --gas-budget 100000000
   # Note the Package ID from output
   ```

2. **Configure CLI**
   
   Create `config.json` in the `sui/` directory:
   ```json
   {
     "sui_network": "testnet",
     "sui_rpc_url": "https://fullnode.testnet.sui.io:443",
     "walrus_network": "testnet",
     "walrus_aggregator_url": "https://aggregator.walrus-testnet.walrus.space",
     "walrus_publisher_url": "https://publisher.walrus-testnet.walrus.space",
     "package_id": "0xYOUR_PACKAGE_ID",
     "catalog_id": "",
     "private_key": "your_hex_private_key_here"
   }
   ```

3. **Create Catalog**
   ```bash
   ./catalogctl gen-create-catalog --name "My Games" --description "My game collection"
   # Run the generated sui client call command
   # Note the Catalog Object ID
   ```

4. **Upload Game to Walrus**
   ```bash
   ./catalogctl upload-blob --file game.zip
   # Note the blob_id and sha256 from output
   ```

5. **Create Cartridge**
   
   Use the `sui client call` command printed by `upload-blob`, or generate manually:
   ```bash
   sui client call \
     --package 0xYOUR_PACKAGE_ID \
     --module cartridge \
     --function create_cartridge \
     --args "game-slug" "Game Title" 3 "jsnes" 1 0xBLOB_ID 0xSHA256 12345 1704000000000 \
     --gas-budget 10000000
   ```

6. **Add to Catalog**
   ```bash
   ./catalogctl gen-add-entry \
     --catalog 0xCATALOG_ID \
     --slug "game-slug" \
     --cartridge 0xCARTRIDGE_ID \
     --title "Game Title" \
     --platform nes \
     --size 12345
   # Run the generated sui client call command
   ```

#### Platform Codes
- `0` - DOS
- `1` - GB
- `2` - GBC
- `3` - NES
- `4` - SNES

#### Frontend Configuration

Add to `.env` in `/web`:
```env
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io:443
VITE_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
VITE_SUI_CATALOG_ID=0xYOUR_CATALOG_ID
```

See [sui/README.md](sui/README.md) for full documentation.

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

### Sui + Walrus
- Go 1.21+
- Sui CLI
- Sui testnet account with SUI tokens

## Architecture

### Storage Format

Games are stored using different formats depending on the blockchain:
- **Nimiq** - Chunked storage (51-byte chunks in transactions)
- **Solana** - Chunked storage (128KB chunks in accounts)
- **Sui** - Single blob storage on Walrus with metadata on Sui (no chunking)
- **Manifest** - Metadata (size, hash, chunk count, platform)
- **Catalog** - Index of available games

### Protocol Drivers

The web frontend uses protocol drivers to abstract blockchain differences:
- `drivers/nimiq.js` - Nimiq blockchain integration
- `drivers/solana.js` - Solana blockchain integration
- `drivers/suiWalrus.js` - Sui blockchain + Walrus blob storage integration
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

