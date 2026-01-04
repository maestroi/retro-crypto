// Package main provides the catalogctl CLI tool for managing Sui/Walrus game catalogs
package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/retro-crypto/sui/internal/base58"
	"github.com/retro-crypto/sui/internal/config"
	"github.com/retro-crypto/sui/internal/model"
	"github.com/retro-crypto/sui/internal/sui"
	"github.com/retro-crypto/sui/internal/walrus"
	"github.com/spf13/cobra"
)

var (
	cfg *config.Config
	// Version information (set by ldflags during build)
	Version   = "dev"
	BuildTime = "unknown"
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

Configuration (priority order):
  1. config.json (recommended)
  2. .env file (legacy)
  3. Environment variables

Required config fields:
  - package_id: Deployed cartridge_storage package ID
  - sui_rpc_url: Sui RPC endpoint (or sui_network for defaults)
  - walrus_aggregator_url: Walrus aggregator for reading blobs
  - walrus_publisher_url: Walrus publisher for uploading blobs
  - private_key or mnemonic: For signing transactions

This tool helps with:
  - Creating catalogs and adding entries (on-chain)
  - Uploading blobs to Walrus
  - Reading catalog/cartridge data
  - Managing game metadata`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		var err error
		cfg, err = config.Load()
		return err
	},
}

func init() {
	// Add version command
	rootCmd.AddCommand(&cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("catalogctl %s\n", Version)
			fmt.Printf("Built: %s\n", BuildTime)
		},
	})
}

// ============================================================================
// upload-blob command
// ============================================================================

var uploadBlobCmd = &cobra.Command{
	Use:   "upload-blob",
	Short: "Upload a file to Walrus and get blob ID",
	Long: `Uploads a file to Walrus storage and returns the blob ID.
This blob ID can then be used when creating a Cartridge on Sui.`,
	RunE: runUploadBlob,
}

var (
	uploadFilePath string
	uploadEpochs   int
)

func init() {
	uploadBlobCmd.Flags().StringVar(&uploadFilePath, "file", "", "Path to file to upload (required)")
	uploadBlobCmd.Flags().IntVar(&uploadEpochs, "epochs", 5, "Number of storage epochs")
	uploadBlobCmd.MarkFlagRequired("file")
	rootCmd.AddCommand(uploadBlobCmd)
}

func runUploadBlob(cmd *cobra.Command, args []string) error {
	// Read file
	filePath, err := filepath.Abs(uploadFilePath)
	if err != nil {
		return fmt.Errorf("invalid file path: %w", err)
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// Compute SHA256
	hash := sha256.Sum256(data)
	sha256Hex := hex.EncodeToString(hash[:])

	fmt.Printf("Uploading %s (%d bytes)...\n", filepath.Base(filePath), len(data))
	fmt.Printf("SHA256: %s\n", sha256Hex)

	// Upload to Walrus
	walrusClient := walrus.NewClient(cfg.WalrusAggregatorURL, cfg.WalrusPublisherURL)
	storeResp, err := walrusClient.Store(data, uploadEpochs)
	if err != nil {
		return fmt.Errorf("failed to upload: %w", err)
	}

	blobID := storeResp.GetBlobID()
	if blobID == "" {
		return fmt.Errorf("no blob ID in response")
	}

	result := map[string]interface{}{
		"blob_id":    blobID,
		"sha256":     sha256Hex,
		"size_bytes": len(data),
		"epochs":     uploadEpochs,
	}

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println("\n✓ Upload successful!")
	fmt.Println(string(jsonBytes))

	// Print sui command helper
	fmt.Println("\nTo create a Cartridge on Sui, run:")
	fmt.Printf(`sui client call \
  --package %s \
  --module cartridge \
  --function create_cartridge \
  --args \
    "your-slug" \
    "Your Game Title" \
    0 \
    "jsdos" \
    1 \
    0x%s \
    0x%s \
    %d \
    $(date +%%s)000 \
  --gas-budget 10000000
`, cfg.PackageID, blobID, sha256Hex, len(data))

	return nil
}

// ============================================================================
// list-catalog command
// ============================================================================

var listCatalogCmd = &cobra.Command{
	Use:   "list-catalog",
	Short: "List all games in a catalog",
	RunE:  runListCatalog,
}

var listCatalogID string

func init() {
	listCatalogCmd.Flags().StringVar(&listCatalogID, "catalog", "", "Catalog object ID (optional, uses config.catalog_id if not set)")
	rootCmd.AddCommand(listCatalogCmd)
}

func runListCatalog(cmd *cobra.Command, args []string) error {
	// Use flag value or fall back to config
	catalogID := listCatalogID
	if catalogID == "" {
		catalogID = cfg.CatalogID
	}
	if catalogID == "" {
		return fmt.Errorf("catalog ID required: set --catalog flag or catalog_id in config file")
	}

	client := sui.NewClient(cfg.SuiRPCURL)

	// Get catalog object
	catalogResp, err := client.GetObject(catalogID)
	if err != nil {
		return fmt.Errorf("failed to get catalog: %w", err)
	}

	if catalogResp.Data == nil {
		return fmt.Errorf("catalog not found")
	}

	fields := sui.ParseCatalog(catalogResp.Data)

	name, _ := fields["name"].(string)
	description, _ := fields["description"].(string)
	owner, _ := fields["owner"].(string)
	count := int64(0)
	if c, ok := fields["count"].(float64); ok {
		count = int64(c)
	}

	fmt.Printf("Catalog: %s\n", name)
	fmt.Printf("Description: %s\n", description)
	fmt.Printf("Owner: %s\n", owner)
	fmt.Printf("Entries: %d\n\n", count)

	// Get dynamic fields (catalog entries)
	var cursor *string
	entries := []map[string]interface{}{}

	for {
		fieldsResp, err := client.GetDynamicFields(catalogID, cursor, 50)
		if err != nil {
			return fmt.Errorf("failed to get entries: %w", err)
		}

		for _, field := range fieldsResp.Data {
			// Get dynamic field object
			fieldObj, err := client.GetDynamicFieldObject(catalogID, field.Name)
			if err != nil {
				continue
			}

			if fieldObj.Data == nil {
				continue
			}

			entryFields := sui.ParseCatalogEntry(fieldObj.Data)
			if entryFields == nil {
				continue
			}

			slug := ""
			if s, ok := field.Name.Value.(string); ok {
				slug = s
			}

			entry := map[string]interface{}{
				"slug":         slug,
				"cartridge_id": entryFields["cartridge_id"],
				"title":        entryFields["title"],
				"platform":     entryFields["platform"],
				"size_bytes":   entryFields["size_bytes"],
				"version":      entryFields["version"],
			}
			entries = append(entries, entry)
		}

		if !fieldsResp.HasNextPage || fieldsResp.NextCursor == nil {
			break
		}
		cursor = fieldsResp.NextCursor
	}

	if len(entries) == 0 {
		fmt.Println("No games in catalog.")
		return nil
	}

	fmt.Printf("%-20s %-30s %-8s %-8s %s\n", "SLUG", "TITLE", "PLATFORM", "VERSION", "CARTRIDGE_ID")
	fmt.Println("----------------------------------------------------------------------------------------")

	for _, entry := range entries {
		slug, _ := entry["slug"].(string)
		title, _ := entry["title"].(string)
		cartridgeID, _ := entry["cartridge_id"].(string)

		platform := uint8(0)
		if p, ok := entry["platform"].(float64); ok {
			platform = uint8(p)
		}

		version := uint16(1)
		if v, ok := entry["version"].(float64); ok {
			version = uint16(v)
		}

		fmt.Printf("%-20s %-30s %-8s v%-7d %s\n",
			truncate(slug, 20),
			truncate(title, 30),
			model.Platform(platform).String(),
			version,
			truncate(cartridgeID, 20),
		)
	}

	return nil
}

// ============================================================================
// get-cartridge command
// ============================================================================

var getCartridgeCmd = &cobra.Command{
	Use:   "get-cartridge",
	Short: "Get cartridge details",
	RunE:  runGetCartridge,
}

var getCartridgeID string

func init() {
	getCartridgeCmd.Flags().StringVar(&getCartridgeID, "id", "", "Cartridge object ID (required)")
	getCartridgeCmd.MarkFlagRequired("id")
	rootCmd.AddCommand(getCartridgeCmd)
}

func runGetCartridge(cmd *cobra.Command, args []string) error {
	client := sui.NewClient(cfg.SuiRPCURL)

	resp, err := client.GetObject(getCartridgeID)
	if err != nil {
		return fmt.Errorf("failed to get cartridge: %w", err)
	}

	if resp.Data == nil {
		return fmt.Errorf("cartridge not found")
	}

	fields := sui.ParseCatalog(resp.Data)

	// Convert byte arrays to hex
	blobID := sui.BytesArrayToHex(fields["blob_id"])
	sha256Hash := sui.BytesArrayToHex(fields["sha256"])

	result := map[string]interface{}{
		"id":            resp.Data.ObjectID,
		"slug":          fields["slug"],
		"title":         fields["title"],
		"platform":      fields["platform"],
		"emulator_core": fields["emulator_core"],
		"version":       fields["version"],
		"blob_id":       blobID,
		"sha256":        sha256Hash,
		"size_bytes":    fields["size_bytes"],
		"publisher":     fields["publisher"],
		"created_at_ms": fields["created_at_ms"],
	}

	jsonBytes, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(jsonBytes))

	return nil
}

// ============================================================================
// download-blob command
// ============================================================================

var downloadBlobCmd = &cobra.Command{
	Use:   "download-blob",
	Short: "Download a blob from Walrus",
	RunE:  runDownloadBlob,
}

var (
	downloadBlobID string
	downloadOutput string
)

func init() {
	downloadBlobCmd.Flags().StringVar(&downloadBlobID, "blob-id", "", "Walrus blob ID (required)")
	downloadBlobCmd.Flags().StringVar(&downloadOutput, "output", "", "Output file path (required)")
	downloadBlobCmd.MarkFlagRequired("blob-id")
	downloadBlobCmd.MarkFlagRequired("output")
	rootCmd.AddCommand(downloadBlobCmd)
}

func runDownloadBlob(cmd *cobra.Command, args []string) error {
	walrusClient := walrus.NewClient(cfg.WalrusAggregatorURL, cfg.WalrusPublisherURL)

	fmt.Printf("Downloading blob %s...\n", downloadBlobID)

	data, err := walrusClient.ReadWithRetry(downloadBlobID, 3)
	if err != nil {
		return fmt.Errorf("failed to download: %w", err)
	}

	// Compute SHA256 of downloaded data
	hash := sha256.Sum256(data)
	sha256Hex := hex.EncodeToString(hash[:])

	// Write to file
	if err := os.WriteFile(downloadOutput, data, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	fmt.Printf("✓ Downloaded %d bytes to %s\n", len(data), downloadOutput)
	fmt.Printf("  SHA256: %s\n", sha256Hex)

	return nil
}

// ============================================================================
// create-catalog command (executes transaction)
// ============================================================================

var createCatalogCmd = &cobra.Command{
	Use:   "create-catalog",
	Short: "Create a new catalog on Sui",
	Long:  `Creates a new catalog on Sui blockchain and prints the catalog ID.`,
	RunE:  runCreateCatalog,
}

var (
	createCatalogName string
	createCatalogDesc string
)

func init() {
	createCatalogCmd.Flags().StringVar(&createCatalogName, "name", "", "Catalog name (required)")
	createCatalogCmd.Flags().StringVar(&createCatalogDesc, "description", "", "Catalog description")
	createCatalogCmd.MarkFlagRequired("name")
	rootCmd.AddCommand(createCatalogCmd)
}

func runCreateCatalog(cmd *cobra.Command, args []string) error {
	if cfg.PackageID == "" {
		return fmt.Errorf("package_id is required in config file")
	}

	fmt.Printf("Creating catalog '%s'...\n", createCatalogName)

	// Execute sui client call
	cmdArgs := []string{
		"client", "call",
		"--package", cfg.PackageID,
		"--module", "catalog",
		"--function", "create_catalog",
		"--args", createCatalogName, createCatalogDesc,
		"--gas-budget", "10000000",
		"--json",
	}

	output, err := executeSuiCommand(cmdArgs)
	if err != nil {
		return fmt.Errorf("failed to create catalog: %w", err)
	}

	// Parse output to extract catalog ID
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(output), &result); err == nil {
		if objectChanges, ok := result["objectChanges"].([]interface{}); ok {
			for _, change := range objectChanges {
				if changeMap, ok := change.(map[string]interface{}); ok {
					if changeType, ok := changeMap["type"].(string); ok && changeType == "created" {
						if objectType, ok := changeMap["objectType"].(string); ok {
							if strings.Contains(objectType, "Catalog") {
								if objectId, ok := changeMap["objectId"].(string); ok {
									fmt.Printf("\n✓ Catalog created successfully!\n")
									fmt.Printf("Catalog ID: %s\n", objectId)
									fmt.Printf("Transaction: %s\n", result["digest"])
									
									// Update config if catalog_id is empty
									if cfg.CatalogID == "" {
										fmt.Printf("\n💡 Tip: Add this to your config.json:\n")
										fmt.Printf("  \"catalog_id\": \"%s\"\n", objectId)
									}
									return nil
								}
							}
						}
					}
				}
			}
		}
	}

	// Fallback: just print the output
	fmt.Println(output)
	return nil
}

// ============================================================================
// gen-create-catalog command (generates sui CLI command)
// ============================================================================

var genCreateCatalogCmd = &cobra.Command{
	Use:   "gen-create-catalog",
	Short: "Generate sui CLI command to create a catalog",
	RunE:  runGenCreateCatalog,
}

var (
	genCatalogName string
	genCatalogDesc string
)

func init() {
	genCreateCatalogCmd.Flags().StringVar(&genCatalogName, "name", "", "Catalog name (required)")
	genCreateCatalogCmd.Flags().StringVar(&genCatalogDesc, "description", "", "Catalog description")
	genCreateCatalogCmd.MarkFlagRequired("name")
	rootCmd.AddCommand(genCreateCatalogCmd)
}

func runGenCreateCatalog(cmd *cobra.Command, args []string) error {
	if cfg.PackageID == "" {
		return fmt.Errorf("package_id is required in config file")
	}

	fmt.Println("Run this command to create the catalog:")
	fmt.Println()
	fmt.Printf(`sui client call \
  --package %s \
  --module catalog \
  --function create_catalog \
  --args "%s" "%s" \
  --gas-budget 10000000
`, cfg.PackageID, genCatalogName, genCatalogDesc)

	return nil
}

// ============================================================================
// add-entry command (executes transaction)
// ============================================================================

var addEntryCmd = &cobra.Command{
	Use:   "add-entry",
	Short: "Add an entry to a catalog",
	Long:  `Adds a game entry to a catalog on Sui blockchain.`,
	RunE:  runAddEntry,
}

var (
	addEntryCatalogID   string
	addEntryCartridgeID string
	addEntrySlug        string
	addEntryTitle       string
	addEntryPlatform    string
	addEntrySizeBytes   uint64
	addEntryEmulator    string
	addEntryVersion     uint16
)

func init() {
	addEntryCmd.Flags().StringVar(&addEntryCatalogID, "catalog", "", "Catalog object ID (optional, uses config.catalog_id if not set)")
	addEntryCmd.Flags().StringVar(&addEntrySlug, "slug", "", "Entry slug (required)")
	addEntryCmd.Flags().StringVar(&addEntryCartridgeID, "cartridge", "", "Cartridge object ID (required)")
	addEntryCmd.Flags().StringVar(&addEntryTitle, "title", "", "Game title (required)")
	addEntryCmd.Flags().StringVar(&addEntryPlatform, "platform", "dos", "Platform: dos, gb, gbc, nes, snes")
	addEntryCmd.Flags().Uint64Var(&addEntrySizeBytes, "size", 0, "Size in bytes (required)")
	addEntryCmd.Flags().StringVar(&addEntryEmulator, "emulator", "", "Emulator core (auto-detected if empty)")
	addEntryCmd.Flags().Uint16Var(&addEntryVersion, "version", 1, "Version number")

	addEntryCmd.MarkFlagRequired("slug")
	addEntryCmd.MarkFlagRequired("cartridge")
	addEntryCmd.MarkFlagRequired("title")
	addEntryCmd.MarkFlagRequired("size")
	rootCmd.AddCommand(addEntryCmd)
}

func runAddEntry(cmd *cobra.Command, args []string) error {
	if cfg.PackageID == "" {
		return fmt.Errorf("package_id is required in config file")
	}

	// Use flag value or fall back to config
	catalogID := addEntryCatalogID
	if catalogID == "" {
		catalogID = cfg.CatalogID
	}
	if catalogID == "" {
		return fmt.Errorf("catalog ID required: set --catalog flag or catalog_id in config file")
	}

	platform, err := model.ParsePlatform(addEntryPlatform)
	if err != nil {
		return err
	}

	emulator := addEntryEmulator
	if emulator == "" {
		emulator = model.EmulatorCoreForPlatform(platform)
	}

	fmt.Printf("Adding entry '%s' to catalog %s...\n", addEntrySlug, catalogID)

	// Execute sui client call
	cmdArgs := []string{
		"client", "call",
		"--package", cfg.PackageID,
		"--module", "catalog",
		"--function", "add_entry",
		"--args",
		catalogID,
		addEntrySlug,
		addEntryCartridgeID,
		addEntryTitle,
		fmt.Sprintf("%d", platform),
		fmt.Sprintf("%d", addEntrySizeBytes),
		emulator,
		fmt.Sprintf("%d", addEntryVersion),
		"[]",
		"--gas-budget", "10000000",
		"--json",
	}

	output, err := executeSuiCommand(cmdArgs)
	if err != nil {
		return fmt.Errorf("failed to add entry: %w", err)
	}

	fmt.Printf("\n✓ Entry added successfully!\n")
	fmt.Printf("Transaction: %s\n", extractDigest(output))
	return nil
}

// ============================================================================
// gen-add-entry command (generates sui CLI command)
// ============================================================================

var genAddEntryCmd = &cobra.Command{
	Use:   "gen-add-entry",
	Short: "Generate sui CLI command to add an entry to a catalog",
	RunE:  runGenAddEntry,
}

var (
	genEntryCatalogID   string
	genEntryCartridgeID string
	genEntrySlug        string
	genEntryTitle       string
	genEntryPlatform    string
	genEntrySizeBytes   uint64
	genEntryEmulator    string
	genEntryVersion     uint16
)

func init() {
	genAddEntryCmd.Flags().StringVar(&genEntryCatalogID, "catalog", "", "Catalog object ID (optional, uses config.catalog_id if not set)")
	genAddEntryCmd.Flags().StringVar(&genEntrySlug, "slug", "", "Entry slug (required)")
	genAddEntryCmd.Flags().StringVar(&genEntryCartridgeID, "cartridge", "", "Cartridge object ID (required)")
	genAddEntryCmd.Flags().StringVar(&genEntryTitle, "title", "", "Game title (required)")
	genAddEntryCmd.Flags().StringVar(&genEntryPlatform, "platform", "dos", "Platform: dos, gb, gbc, nes, snes")
	genAddEntryCmd.Flags().Uint64Var(&genEntrySizeBytes, "size", 0, "Size in bytes (required)")
	genAddEntryCmd.Flags().StringVar(&genEntryEmulator, "emulator", "", "Emulator core (auto-detected if empty)")
	genAddEntryCmd.Flags().Uint16Var(&genEntryVersion, "version", 1, "Version number")

	genAddEntryCmd.MarkFlagRequired("slug")
	genAddEntryCmd.MarkFlagRequired("cartridge")
	genAddEntryCmd.MarkFlagRequired("title")
	genAddEntryCmd.MarkFlagRequired("size")
	rootCmd.AddCommand(genAddEntryCmd)
}

func runGenAddEntry(cmd *cobra.Command, args []string) error {
	if cfg.PackageID == "" {
		return fmt.Errorf("PACKAGE_ID is required")
	}

	// Use flag value or fall back to config
	catalogID := genEntryCatalogID
	if catalogID == "" {
		catalogID = cfg.CatalogID
	}
	if catalogID == "" {
		return fmt.Errorf("catalog ID required: set --catalog flag or catalog_id in config file")
	}

	platform, err := model.ParsePlatform(genEntryPlatform)
	if err != nil {
		return err
	}

	emulator := genEntryEmulator
	if emulator == "" {
		emulator = model.EmulatorCoreForPlatform(platform)
	}

	fmt.Println("Run this command to add the entry:")
	fmt.Println()
	fmt.Printf(`sui client call \
  --package %s \
  --module catalog \
  --function add_entry \
  --args \
    %s \
    "%s" \
    %s \
    "%s" \
    %d \
    %d \
    "%s" \
    %d \
    "[]" \
  --gas-budget 10000000
`, cfg.PackageID, catalogID, genEntrySlug, genEntryCartridgeID,
		genEntryTitle, platform, genEntrySizeBytes, emulator, genEntryVersion)

	return nil
}

// ============================================================================
// remove-entry command (executes transaction)
// ============================================================================

var removeEntryCmd = &cobra.Command{
	Use:   "remove-entry",
	Short: "Remove an entry from a catalog",
	Long:  `Removes a game entry from a catalog on Sui blockchain by slug.`,
	RunE:  runRemoveEntry,
}

var (
	removeEntryCatalogID string
	removeEntrySlug     string
)

func init() {
	removeEntryCmd.Flags().StringVar(&removeEntryCatalogID, "catalog", "", "Catalog object ID (optional, uses config.catalog_id if not set)")
	removeEntryCmd.Flags().StringVar(&removeEntrySlug, "slug", "", "Entry slug to remove (required)")
	removeEntryCmd.MarkFlagRequired("slug")
	rootCmd.AddCommand(removeEntryCmd)
}

func runRemoveEntry(cmd *cobra.Command, args []string) error {
	if cfg.PackageID == "" {
		return fmt.Errorf("package_id is required in config file")
	}

	// Use flag value or fall back to config
	catalogID := removeEntryCatalogID
	if catalogID == "" {
		catalogID = cfg.CatalogID
	}
	if catalogID == "" {
		return fmt.Errorf("catalog ID required: set --catalog flag or catalog_id in config file")
	}

	fmt.Printf("Removing entry '%s' from catalog %s...\n", removeEntrySlug, catalogID)

	// Execute sui client call
	cmdArgs := []string{
		"client", "call",
		"--package", cfg.PackageID,
		"--module", "catalog",
		"--function", "remove_entry",
		"--args",
		catalogID,
		removeEntrySlug,
		"--gas-budget", "10000000",
		"--json",
	}

	output, err := executeSuiCommand(cmdArgs)
	if err != nil {
		return fmt.Errorf("failed to remove entry: %w", err)
	}

	fmt.Printf("\n✓ Entry removed successfully!\n")
	fmt.Printf("Transaction: %s\n", extractDigest(output))
	return nil
}

// ============================================================================
// gen-remove-entry command (generates sui CLI command)
// ============================================================================

var genRemoveEntryCmd = &cobra.Command{
	Use:   "gen-remove-entry",
	Short: "Generate sui CLI command to remove an entry from a catalog",
	RunE:  runGenRemoveEntry,
}

var (
	genRemoveEntryCatalogID string
	genRemoveEntrySlug     string
)

func init() {
	genRemoveEntryCmd.Flags().StringVar(&genRemoveEntryCatalogID, "catalog", "", "Catalog object ID (optional, uses config.catalog_id if not set)")
	genRemoveEntryCmd.Flags().StringVar(&genRemoveEntrySlug, "slug", "", "Entry slug to remove (required)")
	genRemoveEntryCmd.MarkFlagRequired("slug")
	rootCmd.AddCommand(genRemoveEntryCmd)
}

func runGenRemoveEntry(cmd *cobra.Command, args []string) error {
	if cfg.PackageID == "" {
		return fmt.Errorf("package_id is required in config file")
	}

	// Use flag value or fall back to config
	catalogID := genRemoveEntryCatalogID
	if catalogID == "" {
		catalogID = cfg.CatalogID
	}
	if catalogID == "" {
		return fmt.Errorf("catalog ID required: set --catalog flag or catalog_id in config file")
	}

	fmt.Println("Run this command to remove the entry:")
	fmt.Println()
	fmt.Printf(`sui client call \
  --package %s \
  --module catalog \
  --function remove_entry \
  --args \
    %s \
    "%s" \
  --gas-budget 10000000
`, cfg.PackageID, catalogID, genRemoveEntrySlug)

	return nil
}

// ============================================================================
// publish-game command (all-in-one: upload, create cartridge, add to catalog)
// ============================================================================

var publishGameCmd = &cobra.Command{
	Use:   "publish-game",
	Short: "Publish a game: upload to Walrus, create cartridge, and add to catalog",
	Long:  `Complete workflow: uploads file to Walrus, creates cartridge on Sui, and adds entry to catalog.`,
	RunE:  runPublishGame,
}

var (
	publishGameFile      string
	publishGameSlug      string
	publishGameTitle     string
	publishGamePlatform  string
	publishGameEmulator  string
	publishGameVersion   uint16
	publishGameEpochs    int
	publishGameCatalogID string
)

func init() {
	publishGameCmd.Flags().StringVar(&publishGameFile, "file", "", "Path to game ZIP file (required)")
	publishGameCmd.Flags().StringVar(&publishGameSlug, "slug", "", "Game slug identifier (required)")
	publishGameCmd.Flags().StringVar(&publishGameTitle, "title", "", "Game title (required)")
	publishGameCmd.Flags().StringVar(&publishGamePlatform, "platform", "dos", "Platform: dos, gb, gbc, nes, snes")
	publishGameCmd.Flags().StringVar(&publishGameEmulator, "emulator", "", "Emulator core (auto-detected if empty)")
	publishGameCmd.Flags().Uint16Var(&publishGameVersion, "version", 1, "Version number")
	publishGameCmd.Flags().IntVar(&publishGameEpochs, "epochs", 5, "Number of storage epochs for Walrus")
	publishGameCmd.Flags().StringVar(&publishGameCatalogID, "catalog", "", "Catalog object ID (optional, uses config.catalog_id if not set)")

	publishGameCmd.MarkFlagRequired("file")
	publishGameCmd.MarkFlagRequired("slug")
	publishGameCmd.MarkFlagRequired("title")
	rootCmd.AddCommand(publishGameCmd)
}

func runPublishGame(cmd *cobra.Command, args []string) error {
	if cfg.PackageID == "" {
		return fmt.Errorf("package_id is required in config file")
	}

	// Use flag value or fall back to config
	catalogID := publishGameCatalogID
	if catalogID == "" {
		catalogID = cfg.CatalogID
	}
	if catalogID == "" {
		return fmt.Errorf("catalog ID required: set --catalog flag or catalog_id in config file")
	}
	// Validate catalog ID format (must start with 0x)
	if !strings.HasPrefix(catalogID, "0x") {
		return fmt.Errorf("invalid catalog ID format: %s (must start with 0x). Use a valid object ID or omit --catalog to use config.catalog_id", catalogID)
	}

	// Step 1: Read and upload file to Walrus
	fmt.Println("[1/3] Uploading to Walrus...")
	filePath, err := filepath.Abs(publishGameFile)
	if err != nil {
		return fmt.Errorf("invalid file path: %w", err)
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// Compute SHA256
	hash := sha256.Sum256(data)
	sha256Hex := hex.EncodeToString(hash[:])

	fmt.Printf("  File: %s (%d bytes)\n", filepath.Base(filePath), len(data))
	fmt.Printf("  SHA256: %s\n", sha256Hex)
	fmt.Printf("  Publisher URL: %s\n", cfg.WalrusPublisherURL)

	// Upload to Walrus (will fallback to CLI if HTTP fails)
	walrusClient := walrus.NewClient(cfg.WalrusAggregatorURL, cfg.WalrusPublisherURL)
	storeResp, err := walrusClient.Store(data, publishGameEpochs)
	if err != nil {
		if strings.Contains(err.Error(), "walrus CLI failed") {
			return fmt.Errorf("failed to upload to Walrus: %w\n\n"+
				"All publisher nodes failed. Installing Walrus CLI:\n"+
				"  cargo install --git https://github.com/MystenLabs/walrus.git walrus\n\n"+
				"Then run the command again. The CLI uses your own SUI balance.", err)
		}
		return fmt.Errorf("failed to upload to Walrus: %w", err)
	}

	blobID := storeResp.GetBlobID()
	if blobID == "" {
		return fmt.Errorf("no blob ID in response")
	}

	fmt.Printf("  ✓ Uploaded! Blob ID: %s\n", blobID)

	// Step 2: Create cartridge on Sui
	fmt.Println("\n[2/3] Creating cartridge on Sui...")

	platform, err := model.ParsePlatform(publishGamePlatform)
	if err != nil {
		return err
	}

	emulator := publishGameEmulator
	if emulator == "" {
		emulator = model.EmulatorCoreForPlatform(platform)
	}

	// Get current timestamp in milliseconds
	now := time.Now().UnixMilli()

	// Decode blob ID from base58 to bytes, then convert to hex
	// Using akamensky/base58 which supports custom alphabets
	// Walrus uses the full Base58 alphabet (including lowercase 'l')
	blobIDBytes, err := base58.Decode(blobID)
	if err != nil {
		return fmt.Errorf("failed to decode blob ID from base58: %w", err)
	}
	blobIDHex := hex.EncodeToString(blobIDBytes)

	// Execute sui client call to create cartridge
	createCartridgeArgs := []string{
		"client", "call",
		"--package", cfg.PackageID,
		"--module", "cartridge",
		"--function", "create_cartridge",
		"--args",
		publishGameSlug,
		publishGameTitle,
		fmt.Sprintf("%d", platform),
		emulator,
		fmt.Sprintf("%d", publishGameVersion),
		"0x" + blobIDHex,
		"0x" + sha256Hex,
		fmt.Sprintf("%d", len(data)),
		fmt.Sprintf("%d", now),
		"--gas-budget", "10000000",
		"--json",
	}

	createOutput, err := executeSuiCommand(createCartridgeArgs)
	if err != nil {
		return fmt.Errorf("failed to create cartridge: %w", err)
	}

	// Extract cartridge ID from transaction output
	cartridgeID := extractObjectID(createOutput, "Cartridge")
	if cartridgeID == "" {
		return fmt.Errorf("failed to extract cartridge ID from transaction")
	}

	fmt.Printf("  ✓ Cartridge created! ID: %s\n", cartridgeID)

	// Step 3: Add entry to catalog
	fmt.Println("\n[3/3] Adding entry to catalog...")

	addEntryArgs := []string{
		"client", "call",
		"--package", cfg.PackageID,
		"--module", "catalog",
		"--function", "add_entry",
		"--args",
		catalogID,
		publishGameSlug,
		cartridgeID,
		publishGameTitle,
		fmt.Sprintf("%d", platform),
		fmt.Sprintf("%d", len(data)),
		emulator,
		fmt.Sprintf("%d", publishGameVersion),
		"[]",
		"--gas-budget", "10000000",
		"--json",
	}

	addEntryOutput, err := executeSuiCommand(addEntryArgs)
	if err != nil {
		return fmt.Errorf("failed to add entry to catalog: %w", err)
	}

	fmt.Printf("  ✓ Entry added to catalog!\n")

	// Print summary
	fmt.Println("\n✓ Game published successfully!")
	fmt.Println("\nSummary:")
	fmt.Printf("  Slug: %s\n", publishGameSlug)
	fmt.Printf("  Title: %s\n", publishGameTitle)
	fmt.Printf("  Platform: %s\n", publishGamePlatform)
	fmt.Printf("  Blob ID: %s\n", blobID)
	fmt.Printf("  Cartridge ID: %s\n", cartridgeID)
	fmt.Printf("  Catalog ID: %s\n", catalogID)
	fmt.Printf("  Transactions:\n")
	fmt.Printf("    - Create cartridge: %s\n", extractDigest(createOutput))
	fmt.Printf("    - Add entry: %s\n", extractDigest(addEntryOutput))

	return nil
}

// ============================================================================
// Helpers
// ============================================================================

// executeSuiCommand executes a sui CLI command and returns the output
func executeSuiCommand(args []string) (string, error) {
	cmd := exec.Command("sui", args...)
	var stderr bytes.Buffer
	var stdout bytes.Buffer
	cmd.Stderr = &stderr
	cmd.Stdout = &stdout
	err := cmd.Run()
	if err != nil {
		errMsg := stderr.String()
		stdoutMsg := stdout.String()
		if errMsg == "" {
			errMsg = stdoutMsg
		} else if stdoutMsg != "" {
			errMsg = errMsg + "\nStdout: " + stdoutMsg
		}
		return "", fmt.Errorf("sui command failed: %w\nOutput: %s", err, errMsg)
	}
	return strings.TrimSpace(stdout.String()), nil
}

// extractDigest extracts transaction digest from JSON output
func extractDigest(jsonOutput string) string {
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(jsonOutput), &result); err == nil {
		if digest, ok := result["digest"].(string); ok {
			return digest
		}
	}
	return "unknown"
}

// extractObjectID extracts an object ID from transaction output by type name
func extractObjectID(jsonOutput string, typeName string) string {
	var result map[string]interface{}
	if err := json.Unmarshal([]byte(jsonOutput), &result); err != nil {
		return ""
	}

	// Look in objectChanges array
	if objectChanges, ok := result["objectChanges"].([]interface{}); ok {
		for _, change := range objectChanges {
			if changeMap, ok := change.(map[string]interface{}); ok {
				if changeType, ok := changeMap["type"].(string); ok && changeType == "created" {
					if objectType, ok := changeMap["objectType"].(string); ok {
						if strings.Contains(objectType, typeName) {
							if objectId, ok := changeMap["objectId"].(string); ok {
								return objectId
							}
						}
					}
				}
			}
		}
	}

	return ""
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
