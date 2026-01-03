// Package main provides the catalogctl CLI tool for managing Sui/Walrus game catalogs
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/retro-crypto/sui/internal/config"
	"github.com/retro-crypto/sui/internal/model"
	"github.com/retro-crypto/sui/internal/sui"
	"github.com/retro-crypto/sui/internal/walrus"
	"github.com/spf13/cobra"
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

Environment variables (or .env file):
  SUI_RPC_URL           - Sui RPC endpoint (default: testnet)
  SUI_NETWORK           - Network: testnet, devnet, mainnet
  PACKAGE_ID            - Deployed cartridge_storage package ID
  WALRUS_AGGREGATOR_URL - Walrus aggregator for reading blobs
  WALRUS_PUBLISHER_URL  - Walrus publisher for uploading blobs

For on-chain transactions (create catalog, cartridge, etc.), use the 
sui CLI directly. This tool helps with:
  - Uploading blobs to Walrus
  - Reading catalog/cartridge data
  - Generating transaction arguments`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		var err error
		cfg, err = config.Load()
		return err
	},
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
	listCatalogCmd.Flags().StringVar(&listCatalogID, "catalog", "", "Catalog object ID (required)")
	listCatalogCmd.MarkFlagRequired("catalog")
	rootCmd.AddCommand(listCatalogCmd)
}

func runListCatalog(cmd *cobra.Command, args []string) error {
	client := sui.NewClient(cfg.SuiRPCURL)

	// Get catalog object
	catalogResp, err := client.GetObject(listCatalogID)
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
		fieldsResp, err := client.GetDynamicFields(listCatalogID, cursor, 50)
		if err != nil {
			return fmt.Errorf("failed to get entries: %w", err)
		}

		for _, field := range fieldsResp.Data {
			// Get dynamic field object
			fieldObj, err := client.GetDynamicFieldObject(listCatalogID, field.Name)
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
		return fmt.Errorf("PACKAGE_ID is required - set it in .env or environment")
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
	genAddEntryCmd.Flags().StringVar(&genEntryCatalogID, "catalog", "", "Catalog object ID (required)")
	genAddEntryCmd.Flags().StringVar(&genEntrySlug, "slug", "", "Entry slug (required)")
	genAddEntryCmd.Flags().StringVar(&genEntryCartridgeID, "cartridge", "", "Cartridge object ID (required)")
	genAddEntryCmd.Flags().StringVar(&genEntryTitle, "title", "", "Game title (required)")
	genAddEntryCmd.Flags().StringVar(&genEntryPlatform, "platform", "dos", "Platform: dos, gb, gbc, nes, snes")
	genAddEntryCmd.Flags().Uint64Var(&genEntrySizeBytes, "size", 0, "Size in bytes (required)")
	genAddEntryCmd.Flags().StringVar(&genEntryEmulator, "emulator", "", "Emulator core (auto-detected if empty)")
	genAddEntryCmd.Flags().Uint16Var(&genEntryVersion, "version", 1, "Version number")

	genAddEntryCmd.MarkFlagRequired("catalog")
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
`, cfg.PackageID, genEntryCatalogID, genEntrySlug, genEntryCartridgeID,
		genEntryTitle, platform, genEntrySizeBytes, emulator, genEntryVersion)

	return nil
}

// ============================================================================
// Helpers
// ============================================================================

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
