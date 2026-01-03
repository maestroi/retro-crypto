/// Catalog module - curated list of games using dynamic fields
module cartridge_storage::catalog {
    use std::string::String;
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::dynamic_field as df;
    use sui::event;

    /// Error codes
    const E_NOT_OWNER: u64 = 1;
    const E_ENTRY_NOT_FOUND: u64 = 2;
    const E_ENTRY_EXISTS: u64 = 3;

    /// A Catalog is a curated list of game entries
    /// Entries are stored as dynamic fields keyed by slug
    public struct Catalog has key, store {
        id: UID,
        /// Owner who can add/remove entries
        owner: address,
        /// Human readable name (e.g., "Top 25 NES Games")
        name: String,
        /// Description
        description: String,
        /// Number of entries in the catalog
        count: u64,
    }

    /// A catalog entry pointing to a cartridge
    public struct CatalogEntry has store, copy, drop {
        /// ID of the Cartridge object
        cartridge_id: ID,
        /// Game title (denormalized for quick access)
        title: String,
        /// Platform code
        platform: u8,
        /// Size in bytes
        size_bytes: u64,
        /// Emulator core name
        emulator_core: String,
        /// Version
        version: u16,
        /// Optional cover image blob ID (empty if none)
        cover_blob_id: vector<u8>,
    }

    /// Events
    public struct CatalogCreated has copy, drop {
        catalog_id: ID,
        name: String,
        owner: address,
    }

    public struct EntryAdded has copy, drop {
        catalog_id: ID,
        slug: String,
        cartridge_id: ID,
    }

    public struct EntryRemoved has copy, drop {
        catalog_id: ID,
        slug: String,
    }

    public struct EntryUpdated has copy, drop {
        catalog_id: ID,
        slug: String,
        new_cartridge_id: ID,
    }

    /// Create a new empty Catalog
    public entry fun create_catalog(
        name: String,
        description: String,
        ctx: &mut TxContext,
    ) {
        let catalog = Catalog {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            name,
            description,
            count: 0,
        };
        
        let catalog_id = object::uid_to_inner(&catalog.id);
        
        event::emit(CatalogCreated {
            catalog_id,
            name: catalog.name,
            owner: catalog.owner,
        });
        
        transfer::public_share_object(catalog);
    }

    /// Add an entry to the catalog (owner only)
    public entry fun add_entry(
        catalog: &mut Catalog,
        slug: String,
        cartridge_id: ID,
        title: String,
        platform: u8,
        size_bytes: u64,
        emulator_core: String,
        version: u16,
        cover_blob_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == catalog.owner, E_NOT_OWNER);
        assert!(!df::exists_(&catalog.id, slug), E_ENTRY_EXISTS);
        
        let entry = CatalogEntry {
            cartridge_id,
            title,
            platform,
            size_bytes,
            emulator_core,
            version,
            cover_blob_id,
        };
        
        df::add(&mut catalog.id, slug, entry);
        catalog.count = catalog.count + 1;
        
        event::emit(EntryAdded {
            catalog_id: object::uid_to_inner(&catalog.id),
            slug,
            cartridge_id,
        });
    }

    /// Update an existing entry to point to a new cartridge (owner only)
    public entry fun update_entry(
        catalog: &mut Catalog,
        slug: String,
        new_cartridge_id: ID,
        title: String,
        platform: u8,
        size_bytes: u64,
        emulator_core: String,
        version: u16,
        cover_blob_id: vector<u8>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == catalog.owner, E_NOT_OWNER);
        assert!(df::exists_(&catalog.id, slug), E_ENTRY_NOT_FOUND);
        
        // Remove old entry
        let _old: CatalogEntry = df::remove(&mut catalog.id, slug);
        
        // Add new entry
        let entry = CatalogEntry {
            cartridge_id: new_cartridge_id,
            title,
            platform,
            size_bytes,
            emulator_core,
            version,
            cover_blob_id,
        };
        df::add(&mut catalog.id, slug, entry);
        
        event::emit(EntryUpdated {
            catalog_id: object::uid_to_inner(&catalog.id),
            slug,
            new_cartridge_id,
        });
    }

    /// Remove an entry from the catalog (owner only)
    public entry fun remove_entry(
        catalog: &mut Catalog,
        slug: String,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == catalog.owner, E_NOT_OWNER);
        assert!(df::exists_(&catalog.id, slug), E_ENTRY_NOT_FOUND);
        
        let _entry: CatalogEntry = df::remove(&mut catalog.id, slug);
        catalog.count = catalog.count - 1;
        
        event::emit(EntryRemoved {
            catalog_id: object::uid_to_inner(&catalog.id),
            slug,
        });
    }

    /// Check if an entry exists
    public fun has_entry(catalog: &Catalog, slug: String): bool {
        df::exists_(&catalog.id, slug)
    }

    /// Get an entry (for reading)
    public fun get_entry(catalog: &Catalog, slug: String): &CatalogEntry {
        assert!(df::exists_(&catalog.id, slug), E_ENTRY_NOT_FOUND);
        df::borrow(&catalog.id, slug)
    }

    /// Getters for Catalog
    public fun id(catalog: &Catalog): ID { object::uid_to_inner(&catalog.id) }
    public fun owner(catalog: &Catalog): address { catalog.owner }
    public fun name(catalog: &Catalog): &String { &catalog.name }
    public fun description(catalog: &Catalog): &String { &catalog.description }
    public fun count(catalog: &Catalog): u64 { catalog.count }

    /// Getters for CatalogEntry
    public fun entry_cartridge_id(entry: &CatalogEntry): ID { entry.cartridge_id }
    public fun entry_title(entry: &CatalogEntry): &String { &entry.title }
    public fun entry_platform(entry: &CatalogEntry): u8 { entry.platform }
    public fun entry_size_bytes(entry: &CatalogEntry): u64 { entry.size_bytes }
    public fun entry_emulator_core(entry: &CatalogEntry): &String { &entry.emulator_core }
    public fun entry_version(entry: &CatalogEntry): u16 { entry.version }
    public fun entry_cover_blob_id(entry: &CatalogEntry): &vector<u8> { &entry.cover_blob_id }

    /// Transfer ownership of the catalog
    public entry fun transfer_ownership(
        catalog: &mut Catalog,
        new_owner: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == catalog.owner, E_NOT_OWNER);
        catalog.owner = new_owner;
    }
}

