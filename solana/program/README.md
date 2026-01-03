# Cartridge Storage - Solana Program

An Anchor-based Solana program for storing game cartridges (ROMs) on-chain with chunked storage.

## Building

```bash
# Install Anchor CLI
npm install -g @coral-xyz/anchor-cli

# Build the program
anchor build
```

## Deploying

### To Devnet

```bash
# Set Solana to devnet
solana config set --url devnet

# Ensure you have SOL for deployment
solana airdrop 5

# Deploy
anchor deploy --provider.cluster devnet
```

### To Localnet

```bash
# Start local validator
solana-test-validator

# In another terminal
anchor deploy --provider.cluster localnet
```

## Program Architecture

### Accounts

1. **CatalogRoot** (`seeds: ["catalog_root"]`)
   - Global catalog metadata
   - Stores admin pubkey, total cartridge count, page count

2. **CatalogPage** (`seeds: ["catalog_page", page_index]`)
   - Contains up to 32 cartridge entries
   - Each entry has: cartridge_id, manifest_pubkey, zip_size, sha256, created_slot, flags

3. **CartridgeManifest** (`seeds: ["manifest", cartridge_id]`)
   - Metadata for a single cartridge
   - Contains: zip_size, chunk_size, num_chunks, sha256, finalized flag, publisher

4. **CartridgeChunk** (`seeds: ["chunk", cartridge_id, chunk_index]`)
   - Raw bytes for a data chunk
   - Default chunk size: 128KB

### Instructions

1. `initialize_catalog` - One-time setup by admin
2. `create_catalog_page` - Create new page when current is full
3. `create_manifest` - Reserve a new cartridge
4. `write_chunk` - Write data to a chunk account
5. `finalize_cartridge` - Lock cartridge and add to catalog
6. `update_admin` - Transfer admin rights

## Security

- Content-addressed: cartridge_id = sha256(zip_bytes)
- Immutable: chunks cannot be modified after writing
- Finalization: prevents further changes after all chunks written
- Publisher tracking: each cartridge records who published it

## Testing

```bash
# Run tests
anchor test

# Run tests without deploying (assumes validator running)
anchor test --skip-local-validator
```

## Program ID

Default: `CartS1QpBgPfpgq4RpPpXVuvN4SrJvYNXBfW9D1Rmvp`

To change, update `declare_id!()` in `src/lib.rs` and rebuild.

