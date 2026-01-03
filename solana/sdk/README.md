# @solana-retro/sdk

TypeScript SDK for interacting with the Solana cartridge storage program.

## Installation

```bash
npm install @solana-retro/sdk
```

## Usage

### Initialize Client

```typescript
import { CartridgeClient } from '@solana-retro/sdk';

// Connect to devnet
const client = new CartridgeClient('devnet');

// Or use custom RPC
const client = new CartridgeClient('https://my-rpc.example.com');

// Or use existing connection
import { Connection } from '@solana/web3.js';
const connection = new Connection('https://api.devnet.solana.com');
const client = new CartridgeClient(connection);
```

### List Cartridges

```typescript
// List cartridges from latest page
const { entries, totalCartridges, pageCount } = await client.listCartridges();

// List specific page
const result = await client.listCartridges({ pageIndex: 0 });

// List all cartridges across all pages
const allEntries = await client.listAllCartridges();

// Include retired cartridges
const withRetired = await client.listAllCartridges({ includeRetired: true });
```

### Fetch Cartridge

```typescript
// Get manifest only
const manifest = await client.getManifest(cartridgeId);

// Get full cartridge with ZIP bytes
const cartridge = await client.fetchCartridgeBytes(cartridgeId, {
  onProgress: (progress) => {
    console.log(`Phase: ${progress.phase}`);
    console.log(`Chunks: ${progress.chunksLoaded}/${progress.totalChunks}`);
  },
  verifyHash: true, // default: true
});

console.log('ZIP bytes:', cartridge.zipBytes);
console.log('Verified:', cartridge.verified);
```

### Publish Cartridge

```typescript
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

const keypair = Keypair.fromSecretKey(/* your secret key */);
const zipBytes = fs.readFileSync('game.zip');

const result = await client.publishCartridge(keypair, zipBytes, {
  chunkSize: 128 * 1024, // default: 128KB
  metadata: { 
    title: 'My Game',
    platform: 'NES' 
  },
  onProgress: (progress) => {
    console.log(`${progress.phase}: ${progress.chunksWritten}/${progress.totalChunks}`);
  },
});

console.log('Cartridge ID:', result.cartridgeIdHex);
console.log('Signatures:', result.signatures);
```

### Utility Functions

```typescript
import { 
  deriveCatalogRootPDA,
  deriveManifestPDA,
  deriveChunkPDA,
  sha256,
  bytesToHex,
  hexToBytes,
} from '@solana-retro/sdk';

// Derive PDAs
const [catalogRoot, bump] = deriveCatalogRootPDA();
const [manifest] = deriveManifestPDA(cartridgeIdBytes);
const [chunk] = deriveChunkPDA(cartridgeIdBytes, 0);

// Hash utilities
const hash = await sha256(data);
const hex = bytesToHex(hash);
const bytes = hexToBytes(hex);

// Estimate rent
const rentInSOL = await client.estimateRent(zipBytes.length);
```

## API Reference

### CartridgeClient

#### Constructor
- `new CartridgeClient(connectionOrEndpoint, programId?)`

#### Read Methods
- `getCatalogRoot()` - Get catalog root account
- `getCatalogPage(pageIndex)` - Get specific catalog page
- `listCartridges(options?)` - List cartridges with pagination
- `listAllCartridges(options?)` - List all cartridges
- `getManifest(cartridgeId)` - Get cartridge manifest
- `getCartridge(cartridgeId)` - Get cartridge info
- `fetchCartridgeBytes(cartridgeId, options?)` - Fetch full ZIP bytes

#### Write Methods
- `initializeCatalog(admin)` - Initialize catalog (admin only)
- `createCatalogPage(admin, pageIndex)` - Create new page
- `publishCartridge(publisher, zipBytes, options?)` - Publish a cartridge

#### Utility Methods
- `getBalance(address)` - Get SOL balance
- `requestAirdrop(address, amount?)` - Request devnet/testnet airdrop
- `estimateRent(zipSize, chunkSize?)` - Estimate storage rent

### Types

```typescript
interface CatalogEntry {
  cartridgeId: Uint8Array;
  manifestPubkey: PublicKey;
  zipSize: bigint;
  sha256: Uint8Array;
  createdSlot: bigint;
  flags: number;
}

interface CartridgeManifest {
  cartridgeId: Uint8Array;
  zipSize: bigint;
  chunkSize: number;
  numChunks: number;
  sha256: Uint8Array;
  finalized: boolean;
  createdSlot: bigint;
  publisher: PublicKey;
  metadata: Uint8Array;
}

interface PublishResult {
  cartridgeId: Uint8Array;
  cartridgeIdHex: string;
  manifestPubkey: PublicKey;
  signatures: string[];
  alreadyExists?: boolean;
}
```

## Testing

```bash
npm test
```

## License

MIT

