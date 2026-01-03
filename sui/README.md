# Sui + Walrus Cartridge Storage

This module provides on-chain game catalog management on **Sui blockchain** with game data stored on **Walrus** decentralized blob storage.

## Overview

- **Catalog**: A curated list of games stored as a shared Sui object with dynamic fields
- **Cartridge**: Individual game metadata pointing to a Walrus blob
- **Registry** (optional): Discovery mechanism for catalogs

## Prerequisites

### 1. Install Sui CLI

```bash
# macOS
brew install sui

# Or from source
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui
```

### 2. Get Testnet SUI Tokens

1. Create a new address:
   ```bash
   sui client new-address ed25519
   sui client switch --address <YOUR_ADDRESS>
   ```

2. Get testnet SUI from faucet:
   ```bash
   sui client faucet
   ```
   Or visit: https://faucet.testnet.sui.io/

### 3. Get Testnet WAL Tokens (for Walrus)

Walrus testnet uses WAL tokens for storage payments. Visit:
- https://walrus.site/faucet (Walrus faucet)

### 4. Install Go 1.22+

```bash
# macOS
brew install go

# Verify
go version
```

## Quick Start

### 1. Deploy the Move Package

```bash
cd sui/contracts

# Build and deploy to testnet
sui client publish --gas-budget 100000000

# Note the Package ID from output, e.g.:
# Published Objects:
#   PackageID: 0x1234...abcd
```

### 2. Configure CLI

Create a `.env` file in the `sui/` directory:

```env
# Network
SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Your private key (export from sui client)
# Run: sui keytool export --key-identity <ADDRESS>
SUI_PRIVATE_KEY=your_hex_private_key_here

# Package ID from deployment
PACKAGE_ID=0x1234...abcd

# Walrus endpoints
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
```

### 3. Build CLI

```bash
cd sui
go build -o catalogctl ./cmd/catalogctl
```

### 4. Create a Catalog

```bash
./catalogctl init-catalog --name "Top 25 NES Games" --description "Classic NES titles"

# Output:
# ✓ Catalog created successfully!
# {
#   "catalog_id": "0xabc123...",
#   "tx_digest": "..."
# }
```

### 5. Publish a Game

Prepare a ZIP file containing:
- `run.json` - Game metadata
- ROM/game files

Example `run.json`:
```json
{
  "platform": "NES",
  "title": "Super Mario Bros",
  "executable": "smb.nes",
  "year": "1985",
  "publisher": "Nintendo"
}
```

Publish:
```bash
./catalogctl publish-game \
  --catalog 0xabc123... \
  --slug "super-mario-bros" \
  --title "Super Mario Bros" \
  --platform nes \
  --zip ./games/smb.zip \
  --version 1

# Output shows:
# - Blob ID (Walrus)
# - Cartridge ID (Sui)
# - Transaction digest
```

### 6. List Catalog Contents

```bash
./catalogctl list-catalog --catalog 0xabc123...

# Output:
# SLUG                 TITLE                          PLATFORM VERSION   CARTRIDGE_ID
# ------------------------------------------------------------------------------------
# super-mario-bros     Super Mario Bros               NES      v1        0xdef456...
```

## Configure Frontend

Add environment variables to your `.env` file in `/web`:

```env
# Sui RPC endpoint
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Walrus aggregator for downloads
VITE_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space

# Your deployed package ID
VITE_SUI_PACKAGE_ID=0x1234...

# Your catalog ID
VITE_SUI_CATALOG_ID=0xabc123...
```

Then select "Sui + Walrus" in the protocol dropdown.

## CLI Reference

### init-catalog
Create a new catalog.

```bash
catalogctl init-catalog --name "NAME" [--description "DESC"]
```

### publish-game
Upload game to Walrus and register in catalog.

```bash
catalogctl publish-game \
  --catalog CATALOG_ID \
  --slug SLUG \
  --title "TITLE" \
  --platform [dos|gb|gbc|nes|snes] \
  --zip PATH \
  [--emulator CORE] \
  [--version N] \
  [--epochs N]
```

### list-catalog
List all games in a catalog.

```bash
catalogctl list-catalog --catalog CATALOG_ID
```

### get-cartridge
Get detailed cartridge info.

```bash
catalogctl get-cartridge --id CARTRIDGE_ID
```

### set-entry
Update a catalog entry to point to new version.

```bash
catalogctl set-entry --catalog CATALOG_ID --slug SLUG --cartridge NEW_CARTRIDGE_ID
```

### remove-entry
Remove a game from catalog.

```bash
catalogctl remove-entry --catalog CATALOG_ID --slug SLUG
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Vue)                          │
│  /web/src/drivers/suiWalrus.js                                  │
│  - Reads catalogs via Sui RPC                                   │
│  - Downloads blobs from Walrus                                  │
│  - Verifies SHA256                                              │
│  - Extracts ZIP and runs emulator                               │
└────────────────┬────────────────────────┬───────────────────────┘
                 │                        │
                 ▼                        ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│      Sui Blockchain     │    │    Walrus Storage       │
│  - Catalog objects      │    │  - ZIP blobs            │
│  - Cartridge metadata   │    │  - One blob per game    │
│  - Dynamic fields       │    │  - Content-addressed    │
└─────────────────────────┘    └─────────────────────────┘
                 ▲
                 │
┌─────────────────────────────────────────────────────────────────┐
│                       Go CLI (catalogctl)                        │
│  /sui/cmd/catalogctl                                             │
│  - Creates catalogs                                              │
│  - Uploads to Walrus                                             │
│  - Creates cartridge objects                                     │
│  - Manages catalog entries                                       │
└─────────────────────────────────────────────────────────────────┘
```

## On-Chain Data Model

### Catalog (Shared Object)
```move
struct Catalog has key, store {
    id: UID,
    owner: address,
    name: String,
    description: String,
    count: u64,
    // Dynamic fields: slug -> CatalogEntry
}
```

### CatalogEntry (Dynamic Field Value)
```move
struct CatalogEntry has store, copy, drop {
    cartridge_id: ID,
    title: String,
    platform: u8,
    size_bytes: u64,
    emulator_core: String,
    version: u16,
    cover_blob_id: vector<u8>,
}
```

### Cartridge (Owned Object)
```move
struct Cartridge has key, store {
    id: UID,
    slug: String,
    title: String,
    platform: u8,        // 0=DOS, 1=GB, 2=GBC, 3=NES, 4=SNES
    emulator_core: String,
    version: u16,
    blob_id: vector<u8>, // Walrus blob ID
    sha256: vector<u8>,  // For verification
    size_bytes: u64,
    publisher: address,
    created_at_ms: u64,
}
```

## Supported Platforms

| Code | Platform | Emulator Core |
|------|----------|---------------|
| 0    | DOS      | jsdos         |
| 1    | GB       | binjgb        |
| 2    | GBC      | binjgb        |
| 3    | NES      | jsnes         |
| 4    | SNES     | snes9x        |

## Troubleshooting

### "No gas coins available"
Get testnet SUI from faucet:
```bash
sui client faucet
```

### "Walrus upload failed"
1. Check you have WAL tokens
2. Verify publisher URL is correct
3. Try a smaller file first

### "Catalog not found"
Verify the catalog ID exists:
```bash
sui client object CATALOG_ID
```

### "SHA256 verification failed"
The downloaded blob doesn't match on-chain hash. This could indicate:
- Blob corruption
- Wrong blob ID
- Network issue (retry)

## Development

### Run Tests
```bash
cd sui
go test ./...
```

### Build for All Platforms
```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o catalogctl-linux ./cmd/catalogctl

# macOS Intel
GOOS=darwin GOARCH=amd64 go build -o catalogctl-mac ./cmd/catalogctl

# macOS ARM
GOOS=darwin GOARCH=arm64 go build -o catalogctl-mac-arm64 ./cmd/catalogctl

# Windows
GOOS=windows GOARCH=amd64 go build -o catalogctl.exe ./cmd/catalogctl
```

## License

MIT

