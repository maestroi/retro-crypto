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

### 3. Build catalogctl

```bash
cd sui
go build -o catalogctl ./cmd/catalogctl
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

# Package ID from deployment
PACKAGE_ID=0x1234...abcd

# Walrus endpoints
WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space
```

### 3. Create a Catalog

Generate the sui command:
```bash
./catalogctl gen-create-catalog --name "Top 25 NES Games" --description "Classic NES titles"
```

Then run the generated `sui client call` command:
```bash
sui client call \
  --package 0xYOUR_PACKAGE_ID \
  --module catalog \
  --function create_catalog \
  --args "Top 25 NES Games" "Classic NES titles" \
  --gas-budget 10000000
```

Note the **Catalog Object ID** from the output.

### 4. Upload Game to Walrus

```bash
./catalogctl upload-blob --file ./games/mario.zip

# Output:
# ✓ Upload successful!
# {
#   "blob_id": "abc123...",
#   "sha256": "def456...",
#   "size_bytes": 12345
# }
```

### 5. Create Cartridge on Sui

Use the `sui client call` command printed by `upload-blob`, or:

```bash
sui client call \
  --package 0xYOUR_PACKAGE_ID \
  --module cartridge \
  --function create_cartridge \
  --args \
    "mario-bros" \
    "Super Mario Bros" \
    3 \
    "jsnes" \
    1 \
    0xBLOB_ID_FROM_WALRUS \
    0xSHA256_HASH \
    12345 \
    1704000000000 \
  --gas-budget 10000000
```

Platform codes:
- `0` = DOS
- `1` = GB
- `2` = GBC
- `3` = NES
- `4` = SNES

### 6. Add to Catalog

Generate the command:
```bash
./catalogctl gen-add-entry \
  --catalog 0xCATALOG_ID \
  --slug "mario-bros" \
  --cartridge 0xCARTRIDGE_ID \
  --title "Super Mario Bros" \
  --platform nes \
  --size 12345
```

Then run the generated `sui client call` command.

### 7. List Catalog Contents

```bash
./catalogctl list-catalog --catalog 0xCATALOG_ID

# Output:
# Catalog: Top 25 NES Games
# Description: Classic NES titles
# Entries: 1
#
# SLUG                 TITLE                          PLATFORM VERSION   CARTRIDGE_ID
# ----------------------------------------------------------------------------------------
# mario-bros           Super Mario Bros               NES      v1        0xdef456...
```

## CLI Reference

### upload-blob
Upload a file to Walrus.

```bash
catalogctl upload-blob --file PATH [--epochs N]
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

### download-blob
Download a blob from Walrus.

```bash
catalogctl download-blob --blob-id BLOB_ID --output FILE
```

### gen-create-catalog
Generate sui CLI command for creating a catalog.

```bash
catalogctl gen-create-catalog --name "NAME" [--description "DESC"]
```

### gen-add-entry
Generate sui CLI command for adding a catalog entry.

```bash
catalogctl gen-add-entry \
  --catalog CATALOG_ID \
  --slug SLUG \
  --cartridge CARTRIDGE_ID \
  --title "TITLE" \
  --platform [dos|gb|gbc|nes|snes] \
  --size BYTES \
  [--emulator CORE] \
  [--version N]
```

## Configure Frontend

Add environment variables to your `.env` file in `/web`:

```env
# Sui RPC endpoint
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Walrus aggregator for downloads
VITE_WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space

# Your catalog ID
VITE_SUI_CATALOG_ID=0xabc123...
```

Then select "Sui + Walrus" in the protocol dropdown.

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
                 ▲                        ▲
                 │                        │
┌────────────────┴────────────────────────┴───────────────────────┐
│                       catalogctl CLI                             │
│  - upload-blob: Upload ZIPs to Walrus                           │
│  - list-catalog: Read catalog entries                           │
│  - get-cartridge: Read cartridge info                           │
│  - gen-*: Generate sui client call commands                     │
└─────────────────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       sui client CLI                             │
│  - Creates catalogs (on-chain)                                   │
│  - Creates cartridges (on-chain)                                 │
│  - Adds catalog entries (on-chain)                               │
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

## End-to-End Example

```bash
# 1. Deploy contracts (one time)
cd sui/contracts
sui client publish --gas-budget 100000000
# Note: PACKAGE_ID = 0x...

# 2. Set up environment
cd sui
echo "PACKAGE_ID=0x..." >> .env

# 3. Create catalog
./catalogctl gen-create-catalog --name "My NES Games"
# Run the outputted sui client call command
# Note: CATALOG_ID = 0x...

# 4. Prepare game ZIP with run.json
mkdir game && cd game
echo '{"platform":"NES","title":"Mario","rom":"mario.nes"}' > run.json
cp /path/to/mario.nes .
zip -r ../mario.zip *
cd ..

# 5. Upload to Walrus
./catalogctl upload-blob --file mario.zip
# Note: BLOB_ID and SHA256

# 6. Create cartridge (run the sui command from upload output)
# Note: CARTRIDGE_ID = 0x...

# 7. Add to catalog
./catalogctl gen-add-entry \
  --catalog $CATALOG_ID \
  --slug mario \
  --cartridge $CARTRIDGE_ID \
  --title "Super Mario Bros" \
  --platform nes \
  --size 12345
# Run the outputted sui client call command

# 8. Verify
./catalogctl list-catalog --catalog $CATALOG_ID
```

## Troubleshooting

### "No gas coins available"
Get testnet SUI from faucet:
```bash
sui client faucet
```

### "Walrus upload failed"
1. Check Walrus publisher URL is correct
2. Try a smaller file first
3. Ensure you have WAL tokens (visit walrus.site/faucet)

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
