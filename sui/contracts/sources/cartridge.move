/// Cartridge module - represents a single game stored on Walrus
module cartridge_storage::cartridge {
    use std::string::String;
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;

    /// Platform enum values
    const PLATFORM_DOS: u8 = 0;
    const PLATFORM_GB: u8 = 1;
    const PLATFORM_GBC: u8 = 2;
    const PLATFORM_NES: u8 = 3;
    const PLATFORM_SNES: u8 = 4;

    /// Error codes
    const E_INVALID_PLATFORM: u64 = 1;

    /// A Cartridge represents a game stored on Walrus
    public struct Cartridge has key, store {
        id: UID,
        /// Unique slug identifier (e.g., "doom", "mario")
        slug: String,
        /// Human readable title
        title: String,
        /// Platform code (0=DOS, 1=GB, 2=GBC, 3=NES, 4=SNES)
        platform: u8,
        /// Emulator core name (e.g., "jsdos", "jsnes", "binjgb")
        emulator_core: String,
        /// Version number (incremental)
        version: u16,
        /// Walrus blob ID as bytes (256-bit)
        blob_id: vector<u8>,
        /// SHA256 hash of the ZIP file (for verification)
        sha256: vector<u8>,
        /// Size of the ZIP in bytes
        size_bytes: u64,
        /// Publisher address
        publisher: address,
        /// Creation timestamp (milliseconds)
        created_at_ms: u64,
    }

    /// Create a new Cartridge object
    public fun create(
        slug: String,
        title: String,
        platform: u8,
        emulator_core: String,
        version: u16,
        blob_id: vector<u8>,
        sha256: vector<u8>,
        size_bytes: u64,
        created_at_ms: u64,
        ctx: &mut TxContext,
    ): Cartridge {
        assert!(platform <= PLATFORM_SNES, E_INVALID_PLATFORM);
        
        Cartridge {
            id: object::new(ctx),
            slug,
            title,
            platform,
            emulator_core,
            version,
            blob_id,
            sha256,
            size_bytes,
            publisher: tx_context::sender(ctx),
            created_at_ms,
        }
    }

    /// Create and transfer a new Cartridge to the sender
    public entry fun create_cartridge(
        slug: String,
        title: String,
        platform: u8,
        emulator_core: String,
        version: u16,
        blob_id: vector<u8>,
        sha256: vector<u8>,
        size_bytes: u64,
        created_at_ms: u64,
        ctx: &mut TxContext,
    ) {
        let cartridge = create(
            slug, title, platform, emulator_core, version,
            blob_id, sha256, size_bytes, created_at_ms, ctx
        );
        transfer::public_transfer(cartridge, tx_context::sender(ctx));
    }

    /// Get cartridge ID
    public fun id(cartridge: &Cartridge): ID {
        object::uid_to_inner(&cartridge.id)
    }

    /// Getters
    public fun slug(cartridge: &Cartridge): &String { &cartridge.slug }
    public fun title(cartridge: &Cartridge): &String { &cartridge.title }
    public fun platform(cartridge: &Cartridge): u8 { cartridge.platform }
    public fun emulator_core(cartridge: &Cartridge): &String { &cartridge.emulator_core }
    public fun version(cartridge: &Cartridge): u16 { cartridge.version }
    public fun blob_id(cartridge: &Cartridge): &vector<u8> { &cartridge.blob_id }
    public fun sha256(cartridge: &Cartridge): &vector<u8> { &cartridge.sha256 }
    public fun size_bytes(cartridge: &Cartridge): u64 { cartridge.size_bytes }
    public fun publisher(cartridge: &Cartridge): address { cartridge.publisher }
    public fun created_at_ms(cartridge: &Cartridge): u64 { cartridge.created_at_ms }

    /// Platform helper functions
    public fun platform_dos(): u8 { PLATFORM_DOS }
    public fun platform_gb(): u8 { PLATFORM_GB }
    public fun platform_gbc(): u8 { PLATFORM_GBC }
    public fun platform_nes(): u8 { PLATFORM_NES }
    public fun platform_snes(): u8 { PLATFORM_SNES }
}

