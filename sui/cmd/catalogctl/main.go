// Package main provides the catalogctl CLI tool for managing Sui/Walrus game catalogs
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
	"github.com/retro-crypto/sui/internal/config"
	"github.com/retro-crypto/sui/internal/model"
	"github.com/retro-crypto/sui/internal/sui"
	"github.com/retro-crypto/sui/internal/walrus"
)

var (
	cfg *config.Config
)

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

var rootCmd = &cobra.Command{
	Use:   "catalogctl",
	Short: "Manage Sui/Walrus game catalogs",
	Long: `catalogctl is a CLI tool for managing game catalogs on Sui blockchain
with game data stored on Walrus decentralized storage.

Environment variables:
  SUI_RPC_URL          - Sui RPC endpoint (default: testnet)
  SUI_NETWORK          - Network: testnet, devnet, mainnet
  SUI_PRIVATE_KEY      - Private key (hex encoded)
  SUI_MNEMONIC         - Mnemonic phrase (alternative to private key)
  PACKAGE_ID           - Deployed cartridge_storage package ID
  WALRUS_AGGREGATOR_URL - Walrus aggregator for reading blobs
  WALRUS_PUBLISHER_URL  - Walrus publisher for uploading blobs`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		var err error
		cfg, err = config.Load()
		return err
	},
}

// init-catalog command
var initCatalogCmd = &cobra.Command{
	Use:   "init-catalog",
	Short: "Create a new catalog on Sui",
	Long:  `Creates a new shared Catalog object on Sui blockchain.`,
	RunE:  runInitCatalog,
}

var (
	catalogName        string
	catalogDescription string
)

func init() {
	initCatalogCmd.Flags().StringVar(&catalogName, "name", "", "Catalog name (required)")
	initCatalogCmd.Flags().StringVar(&catalogDescription, "description", "", "Catalog description")
	initCatalogCmd.MarkFlagRequired("name")
	rootCmd.AddCommand(initCatalogCmd)
}

func runInitCatalog(cmd *cobra.Command, args []string) error {
	if err := cfg.Validate(); err != nil {
		return err
	}

	suiClient, err := sui.NewClient(cfg.SuiRPCURL, cfg.PackageID)
	if err != nil {
		return fmt.Errorf("failed to create Sui client: %w", err)
	}

	if cfg.PrivateKey != "" {
		if err := suiClient.SetAccountFromPrivateKey(cfg.PrivateKey); err != nil {
			return fmt.Errorf("failed to set account: %w", err)
		}
	} else {
		if err := suiClient.SetAccountFromMnemonic(cfg.Mnemonic); err != nil {
			return fmt.Errorf("failed to set account: %w", err)
		}
	}

	fmt.Printf("Creating catalog '%s'...\n", catalogName)
	fmt.Printf("  Address: %s\n", suiClient.GetAddress())

	ctx := context.Background()
	catalogID, txDigest, err := suiClient.CreateCatalog(ctx, catalogName, catalogDescription)
	if err != nil {
		return fmt.Errorf("failed to create catalog: %w", err)
	}

	result := map[string]string{
		"catalog_id": catalogID,
		"tx_digest":  txDigest,
		"name":       catalogName,
	}

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println("\n✓ Catalog created successfully!")
	fmt.Println(string(jsonBytes))

	return nil
}

// publish-game command
var publishGameCmd = &cobra.Command{
	Use:   "publish-game",
	Short: "Upload a game ZIP to Walrus and register in catalog",
	Long: `Uploads a game ZIP file to Walrus storage, creates a Cartridge object
on Sui, and adds an entry to the specified catalog.`,
	RunE: runPublishGame,
}

var (
	publishCatalogID string
	publishSlug      string
	publishTitle     string
	publishPlatform  string
	publishEmulator  string
	publishZipPath   string
	publishVersion   uint16
	publishEpochs    int
)

func init() {
	publishGameCmd.Flags().StringVar(&publishCatalogID, "catalog", "", "Catalog ID (required)")
	publishGameCmd.Flags().StringVar(&publishSlug, "slug", "", "Unique slug identifier (required)")
	publishGameCmd.Flags().StringVar(&publishTitle, "title", "", "Game title (required)")
	publishGameCmd.Flags().StringVar(&publishPlatform, "platform", "", "Platform: dos, gb, gbc, nes, snes (required)")
	publishGameCmd.Flags().StringVar(&publishEmulator, "emulator", "", "Emulator core (auto-detected if not specified)")
	publishGameCmd.Flags().StringVar(&publishZipPath, "zip", "", "Path to game ZIP file (required)")
	publishGameCmd.Flags().Uint16Var(&publishVersion, "version", 1, "Version number")
	publishGameCmd.Flags().IntVar(&publishEpochs, "epochs", 5, "Number of Walrus storage epochs")

	publishGameCmd.MarkFlagRequired("catalog")
	publishGameCmd.MarkFlagRequired("slug")
	publishGameCmd.MarkFlagRequired("title")
	publishGameCmd.MarkFlagRequired("platform")
	publishGameCmd.MarkFlagRequired("zip")

	rootCmd.AddCommand(publishGameCmd)
}

func runPublishGame(cmd *cobra.Command, args []string) error {
	if err := cfg.ValidateForPublish(); err != nil {
		return err
	}

	// Parse platform
	platform, err := model.ParsePlatform(publishPlatform)
	if err != nil {
		return err
	}

	// Auto-detect emulator if not specified
	emulator := publishEmulator
	if emulator == "" {
		emulator = model.EmulatorCoreForPlatform(platform)
	}

	// Read ZIP file
	zipPath, err := filepath.Abs(publishZipPath)
	if err != nil {
		return fmt.Errorf("invalid zip path: %w", err)
	}

	zipData, err := os.ReadFile(zipPath)
	if err != nil {
		return fmt.Errorf("failed to read ZIP file: %w", err)
	}

	// Compute SHA256
	hash := sha256.Sum256(zipData)
	sha256Hex := hex.EncodeToString(hash[:])

	fmt.Printf("Publishing game '%s' (%s)...\n", publishTitle, publishSlug)
	fmt.Printf("  Platform: %s\n", platform)
	fmt.Printf("  Emulator: %s\n", emulator)
	fmt.Printf("  Size: %d bytes\n", len(zipData))
	fmt.Printf("  SHA256: %s\n", sha256Hex)

	// Upload to Walrus
	fmt.Println("\n[1/3] Uploading to Walrus...")
	walrusClient := walrus.NewClient(cfg.WalrusAggregatorURL, cfg.WalrusPublisherURL)
	storeResp, err := walrusClient.Store(zipData, publishEpochs)
	if err != nil {
		return fmt.Errorf("failed to upload to Walrus: %w", err)
	}

	blobID := storeResp.GetBlobID()
	if blobID == "" {
		return fmt.Errorf("failed to get blob ID from Walrus response")
	}
	fmt.Printf("  Blob ID: %s\n", blobID)

	// Create Sui client
	suiClient, err := sui.NewClient(cfg.SuiRPCURL, cfg.PackageID)
	if err != nil {
		return fmt.Errorf("failed to create Sui client: %w", err)
	}

	if cfg.PrivateKey != "" {
		if err := suiClient.SetAccountFromPrivateKey(cfg.PrivateKey); err != nil {
			return fmt.Errorf("failed to set account: %w", err)
		}
	} else {
		if err := suiClient.SetAccountFromMnemonic(cfg.Mnemonic); err != nil {
			return fmt.Errorf("failed to set account: %w", err)
		}
	}

	// Create Cartridge object
	fmt.Println("\n[2/3] Creating Cartridge on Sui...")
	cartridge := &model.Cartridge{
		Slug:         publishSlug,
		Title:        publishTitle,
		Platform:     platform,
		EmulatorCore: emulator,
		Version:      publishVersion,
		BlobID:       blobID,
		SHA256:       sha256Hex,
		SizeBytes:    uint64(len(zipData)),
		CreatedAt:    time.Now(),
	}

	ctx := context.Background()
	cartridgeID, txDigest1, err := suiClient.CreateCartridge(ctx, cartridge)
	if err != nil {
		return fmt.Errorf("failed to create cartridge: %w", err)
	}
	fmt.Printf("  Cartridge ID: %s\n", cartridgeID)

	// Add to catalog
	fmt.Println("\n[3/3] Adding to catalog...")
	entry := &model.CatalogEntry{
		Slug:         publishSlug,
		CartridgeID:  cartridgeID,
		Title:        publishTitle,
		Platform:     platform,
		SizeBytes:    uint64(len(zipData)),
		EmulatorCore: emulator,
		Version:      publishVersion,
	}

	txDigest2, err := suiClient.AddCatalogEntry(ctx, publishCatalogID, entry)
	if err != nil {
		return fmt.Errorf("failed to add catalog entry: %w", err)
	}

	// Output result
	result := &model.PublishResult{
		CatalogID:   publishCatalogID,
		CartridgeID: cartridgeID,
		BlobID:      blobID,
		SHA256:      sha256Hex,
		SizeBytes:   uint64(len(zipData)),
		TxDigest:    txDigest2,
		Slug:        publishSlug,
		Title:       publishTitle,
	}

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println("\n✓ Game published successfully!")
	fmt.Println(string(jsonBytes))
	fmt.Printf("\nTransaction digests:\n  Cartridge: %s\n  Catalog:   %s\n", txDigest1, txDigest2)

	return nil
}

// list-catalog command
var listCatalogCmd = &cobra.Command{
	Use:   "list-catalog",
	Short: "List all games in a catalog",
	RunE:  runListCatalog,
}

var listCatalogID string

func init() {
	listCatalogCmd.Flags().StringVar(&listCatalogID, "catalog", "", "Catalog ID (required)")
	listCatalogCmd.MarkFlagRequired("catalog")
	rootCmd.AddCommand(listCatalogCmd)
}

func runListCatalog(cmd *cobra.Command, args []string) error {
	suiClient, err := sui.NewClient(cfg.SuiRPCURL, cfg.PackageID)
	if err != nil {
		return fmt.Errorf("failed to create Sui client: %w", err)
	}

	ctx := context.Background()

	// Get catalog info
	catalog, err := suiClient.GetCatalog(ctx, listCatalogID)
	if err != nil {
		return fmt.Errorf("failed to get catalog: %w", err)
	}

	fmt.Printf("Catalog: %s\n", catalog.Name)
	fmt.Printf("Description: %s\n", catalog.Description)
	fmt.Printf("Owner: %s\n", catalog.Owner)
	fmt.Printf("Entries: %d\n\n", catalog.Count)

	// Get entries
	entries, err := suiClient.GetCatalogEntries(ctx, listCatalogID)
	if err != nil {
		return fmt.Errorf("failed to get catalog entries: %w", err)
	}

	if len(entries) == 0 {
		fmt.Println("No games in catalog.")
		return nil
	}

	fmt.Printf("%-20s %-30s %-8s %-10s %s\n", "SLUG", "TITLE", "PLATFORM", "VERSION", "CARTRIDGE_ID")
	fmt.Println("-------------------------------------------------------------------------------------")
	for _, entry := range entries {
		fmt.Printf("%-20s %-30s %-8s v%-9d %s\n",
			truncate(entry.Slug, 20),
			truncate(entry.Title, 30),
			entry.Platform,
			entry.Version,
			entry.CartridgeID,
		)
	}

	return nil
}

// get-cartridge command
var getCartridgeCmd = &cobra.Command{
	Use:   "get-cartridge",
	Short: "Get cartridge details",
	RunE:  runGetCartridge,
}

var getCartridgeID string

func init() {
	getCartridgeCmd.Flags().StringVar(&getCartridgeID, "id", "", "Cartridge ID (required)")
	getCartridgeCmd.MarkFlagRequired("id")
	rootCmd.AddCommand(getCartridgeCmd)
}

func runGetCartridge(cmd *cobra.Command, args []string) error {
	suiClient, err := sui.NewClient(cfg.SuiRPCURL, cfg.PackageID)
	if err != nil {
		return fmt.Errorf("failed to create Sui client: %w", err)
	}

	ctx := context.Background()
	cartridge, err := suiClient.GetCartridge(ctx, getCartridgeID)
	if err != nil {
		return fmt.Errorf("failed to get cartridge: %w", err)
	}

	jsonBytes, _ := json.MarshalIndent(cartridge, "", "  ")
	fmt.Println(string(jsonBytes))

	return nil
}

// set-entry command
var setEntryCmd = &cobra.Command{
	Use:   "set-entry",
	Short: "Update a catalog entry to point to a new cartridge",
	RunE:  runSetEntry,
}

var (
	setEntryCatalogID   string
	setEntrySlug        string
	setEntryCartridgeID string
)

func init() {
	setEntryCmd.Flags().StringVar(&setEntryCatalogID, "catalog", "", "Catalog ID (required)")
	setEntryCmd.Flags().StringVar(&setEntrySlug, "slug", "", "Entry slug (required)")
	setEntryCmd.Flags().StringVar(&setEntryCartridgeID, "cartridge", "", "New cartridge ID (required)")
	setEntryCmd.MarkFlagRequired("catalog")
	setEntryCmd.MarkFlagRequired("slug")
	setEntryCmd.MarkFlagRequired("cartridge")
	rootCmd.AddCommand(setEntryCmd)
}

func runSetEntry(cmd *cobra.Command, args []string) error {
	if err := cfg.Validate(); err != nil {
		return err
	}

	// Get the cartridge info first
	suiClient, err := sui.NewClient(cfg.SuiRPCURL, cfg.PackageID)
	if err != nil {
		return fmt.Errorf("failed to create Sui client: %w", err)
	}

	if cfg.PrivateKey != "" {
		if err := suiClient.SetAccountFromPrivateKey(cfg.PrivateKey); err != nil {
			return fmt.Errorf("failed to set account: %w", err)
		}
	} else {
		if err := suiClient.SetAccountFromMnemonic(cfg.Mnemonic); err != nil {
			return fmt.Errorf("failed to set account: %w", err)
		}
	}

	ctx := context.Background()

	cartridge, err := suiClient.GetCartridge(ctx, setEntryCartridgeID)
	if err != nil {
		return fmt.Errorf("failed to get cartridge: %w", err)
	}

	entry := &model.CatalogEntry{
		Slug:         setEntrySlug,
		CartridgeID:  setEntryCartridgeID,
		Title:        cartridge.Title,
		Platform:     cartridge.Platform,
		SizeBytes:    cartridge.SizeBytes,
		EmulatorCore: cartridge.EmulatorCore,
		Version:      cartridge.Version,
	}

	// Note: This would need an update_entry function call, which I'll add
	fmt.Printf("Updating entry '%s' to point to cartridge %s...\n", setEntrySlug, setEntryCartridgeID)
	fmt.Printf("  Title: %s\n", entry.Title)
	fmt.Printf("  Platform: %s\n", entry.Platform)
	fmt.Printf("  Version: %d\n", entry.Version)

	// For now, output what would be updated
	fmt.Println("\n(Note: Full implementation requires update_entry transaction)")
	return nil
}

// remove-entry command
var removeEntryCmd = &cobra.Command{
	Use:   "remove-entry",
	Short: "Remove an entry from a catalog",
	RunE:  runRemoveEntry,
}

var (
	removeEntryCatalogID string
	removeEntrySlug      string
)

func init() {
	removeEntryCmd.Flags().StringVar(&removeEntryCatalogID, "catalog", "", "Catalog ID (required)")
	removeEntryCmd.Flags().StringVar(&removeEntrySlug, "slug", "", "Entry slug to remove (required)")
	removeEntryCmd.MarkFlagRequired("catalog")
	removeEntryCmd.MarkFlagRequired("slug")
	rootCmd.AddCommand(removeEntryCmd)
}

func runRemoveEntry(cmd *cobra.Command, args []string) error {
	if err := cfg.Validate(); err != nil {
		return err
	}

	fmt.Printf("Removing entry '%s' from catalog %s...\n", removeEntrySlug, removeEntryCatalogID)
	fmt.Println("\n(Note: Full implementation requires remove_entry transaction)")
	return nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

