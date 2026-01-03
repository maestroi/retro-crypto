# @solana-retro/cli

Command-line tool for managing on-chain game cartridges on Solana.

## Installation

```bash
npm install -g @solana-retro/cli
```

Or run directly with npx:

```bash
npx @solana-retro/cli list
```

## Commands

### List Cartridges

```bash
# List cartridges on devnet
cartridge-cli list --network devnet

# List all pages
cartridge-cli list --all

# Include retired cartridges
cartridge-cli list --include-retired

# List specific page
cartridge-cli list --page 1
```

### Get Cartridge Info

```bash
cartridge-cli info <cartridge-id>
```

### Publish Cartridge

```bash
# Publish a ZIP file
cartridge-cli publish game.zip --network devnet

# Dry run (estimate costs without publishing)
cartridge-cli publish game.zip --dry-run

# Custom chunk size
cartridge-cli publish game.zip --chunk-size 65536
```

### Initialize Catalog

```bash
# One-time setup (admin only)
cartridge-cli init --network devnet
```

### Airdrop SOL

```bash
# Get 2 SOL (default)
cartridge-cli airdrop --network devnet

# Get specific amount
cartridge-cli airdrop --amount 5
```

### Check Balance

```bash
# Check keypair balance
cartridge-cli balance

# Check specific address
cartridge-cli balance --address <pubkey>
```

### Derive PDAs

```bash
# Show catalog root PDA
cartridge-cli pda --catalog-root

# Show catalog page PDA
cartridge-cli pda --catalog-page 0

# Show manifest PDA
cartridge-cli pda --manifest <cartridge-id>

# Show chunk PDA
cartridge-cli pda --chunk <cartridge-id>:0
```

## Global Options

```bash
# Use specific network
--network <mainnet|devnet|testnet|localnet>

# Use custom RPC URL
--url https://my-rpc.example.com

# Use specific keypair
--keypair /path/to/keypair.json
```

## Configuration

Default keypair path: `~/.config/solana/id.json`

To create a keypair:

```bash
solana-keygen new
```

## Examples

### Full Workflow

```bash
# 1. Setup (if needed)
solana-keygen new
solana config set --url devnet

# 2. Get devnet SOL
cartridge-cli airdrop --amount 5 --network devnet

# 3. Check balance
cartridge-cli balance

# 4. Estimate publish cost
cartridge-cli publish game.zip --dry-run

# 5. Publish cartridge
cartridge-cli publish game.zip --network devnet

# 6. Verify it's in the catalog
cartridge-cli list --network devnet

# 7. Get cartridge details
cartridge-cli info <cartridge-id>
```

## License

MIT

