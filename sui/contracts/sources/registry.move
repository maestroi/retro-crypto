/// CatalogRegistry module - optional discovery mechanism for catalogs
module cartridge_storage::registry {
    use std::string::String;
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::dynamic_field as df;
    use sui::event;

    /// Error codes
    const E_NOT_ADMIN: u64 = 1;
    const E_CATALOG_EXISTS: u64 = 2;
    const E_CATALOG_NOT_FOUND: u64 = 3;

    /// Global registry of catalogs for discovery
    public struct CatalogRegistry has key {
        id: UID,
        /// Admin who can add/remove catalogs
        admin: address,
        /// Number of registered catalogs
        count: u64,
    }

    /// Registry entry for a catalog
    public struct RegistryEntry has store, copy, drop {
        /// Catalog object ID
        catalog_id: ID,
        /// Catalog name
        name: String,
        /// Brief description
        description: String,
        /// Primary platform focus (optional, 255 = mixed)
        primary_platform: u8,
    }

    /// Events
    public struct RegistryCreated has copy, drop {
        registry_id: ID,
        admin: address,
    }

    public struct CatalogRegistered has copy, drop {
        registry_id: ID,
        catalog_id: ID,
        name: String,
    }

    public struct CatalogUnregistered has copy, drop {
        registry_id: ID,
        catalog_id: ID,
    }

    /// Create the global registry (should be called once)
    public entry fun create_registry(ctx: &mut TxContext) {
        let registry = CatalogRegistry {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            count: 0,
        };
        
        event::emit(RegistryCreated {
            registry_id: object::uid_to_inner(&registry.id),
            admin: registry.admin,
        });
        
        transfer::share_object(registry);
    }

    /// Register a catalog in the registry (admin only)
    /// Uses catalog_id as the dynamic field key
    public entry fun register_catalog(
        registry: &mut CatalogRegistry,
        catalog_id: ID,
        name: String,
        description: String,
        primary_platform: u8,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_NOT_ADMIN);
        assert!(!df::exists_(&registry.id, catalog_id), E_CATALOG_EXISTS);
        
        let entry = RegistryEntry {
            catalog_id,
            name,
            description,
            primary_platform,
        };
        
        df::add(&mut registry.id, catalog_id, entry);
        registry.count = registry.count + 1;
        
        event::emit(CatalogRegistered {
            registry_id: object::uid_to_inner(&registry.id),
            catalog_id,
            name,
        });
    }

    /// Unregister a catalog (admin only)
    public entry fun unregister_catalog(
        registry: &mut CatalogRegistry,
        catalog_id: ID,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_NOT_ADMIN);
        assert!(df::exists_(&registry.id, catalog_id), E_CATALOG_NOT_FOUND);
        
        let _entry: RegistryEntry = df::remove(&mut registry.id, catalog_id);
        registry.count = registry.count - 1;
        
        event::emit(CatalogUnregistered {
            registry_id: object::uid_to_inner(&registry.id),
            catalog_id,
        });
    }

    /// Check if a catalog is registered
    public fun is_registered(registry: &CatalogRegistry, catalog_id: ID): bool {
        df::exists_(&registry.id, catalog_id)
    }

    /// Get registry info
    public fun get_entry(registry: &CatalogRegistry, catalog_id: ID): &RegistryEntry {
        assert!(df::exists_(&registry.id, catalog_id), E_CATALOG_NOT_FOUND);
        df::borrow(&registry.id, catalog_id)
    }

    /// Getters
    public fun id(registry: &CatalogRegistry): ID { object::uid_to_inner(&registry.id) }
    public fun admin(registry: &CatalogRegistry): address { registry.admin }
    public fun count(registry: &CatalogRegistry): u64 { registry.count }

    /// RegistryEntry getters
    public fun entry_catalog_id(entry: &RegistryEntry): ID { entry.catalog_id }
    public fun entry_name(entry: &RegistryEntry): &String { &entry.name }
    public fun entry_description(entry: &RegistryEntry): &String { &entry.description }
    public fun entry_primary_platform(entry: &RegistryEntry): u8 { entry.primary_platform }

    /// Transfer admin rights
    public entry fun transfer_admin(
        registry: &mut CatalogRegistry,
        new_admin: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == registry.admin, E_NOT_ADMIN);
        registry.admin = new_admin;
    }
}

