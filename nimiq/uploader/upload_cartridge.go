package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/time/rate"
)

type CartridgeUploadProgress struct {
	AppID         uint32       `json:"app_id"`
	CartridgeID   uint32       `json:"cartridge_id"`
	CartridgeAddr string       `json:"cartridge_addr"`
	TotalChunks   int          `json:"total_chunks"`
	SentChunks    int          `json:"sent_chunks"`
	FailedChunks  []int        `json:"failed_chunks,omitempty"`
	CARTTxHash    string       `json:"cart_tx_hash,omitempty"`
	CENTTxHash    string       `json:"cent_tx_hash,omitempty"`
	Plan          []UploadPlan `json:"plan"`
}

func newUploadCartridgeCmd() *cobra.Command {
	var (
		filePath         string
		appID            uint32
		cartridgeID      uint32
		title            string
		semver           string
		platform         uint8
		cartridgeAddr    string
		catalogAddr      string
		sender           string
		dryRun           bool
		rateLimit        float64
		rpcURL           string
		fee              int64
		generateCartAddr bool
		schema           uint8
		chunkSize        uint8
		concurrency      int
	)

	cmd := &cobra.Command{
		Use:   "upload-cartridge",
		Short: "Upload a file as a cartridge (CART + DATA chunks) and register in catalog (CENT)",
		Long: `Upload a file using the new cartridge architecture:
- Generates or uses a cartridge address
- Uploads CART header transaction
- Uploads DATA chunk transactions
- Registers cartridge in catalog with CENT entry`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			// Try to get sender from credentials file if not provided
			if sender == "" {
				sender = GetDefaultAddress()
			}

			if sender == "" {
				return fmt.Errorf("sender address is required (--sender or set in account_credentials.txt)")
			}

			if catalogAddr == "" {
				return fmt.Errorf("catalog address is required (--catalog-addr)")
			}

			// Resolve catalog address shortcuts
			catalogAddr = resolveCatalogAddress(catalogAddr)

			// Initialize RPC for catalog queries
			rpc := NewNimiqRPC(rpcURL)

			// Auto-generate app-id if not provided
			// Note: Even in dry-run, we query the catalog to get correct IDs
			if appID == 0 {
				publisherAddr := sender // Use sender as publisher for filtering
				// Try to find existing app-id by title first (for new versions)
				if title != "" {
					foundAppID, err := FindAppIDByTitle(rpc, catalogAddr, publisherAddr, title)
					if err != nil {
						fmt.Printf("Warning: failed to search for existing app-id by title: %v\n", err)
					} else if foundAppID > 0 {
						appID = foundAppID
						if dryRun {
							fmt.Printf("Found existing app-id %d for title \"%s\" (new version, dry-run)\n", appID, title)
						} else {
							fmt.Printf("Found existing app-id %d for title \"%s\" (new version)\n", appID, title)
							logCartridgeUpload(fmt.Sprintf("Found existing app-id %d for title \"%s\"", appID, title))
						}
					} else {
						fmt.Printf("No existing app-id found for title \"%s\" (will create new game)\n", title)
					}
				}

				// If not found by title, generate new app-id
				if appID == 0 {
					fmt.Println("Auto-generating new app-id...")
					var err error
					appID, err = GetMaxAppID(rpc, catalogAddr, publisherAddr)
					if err != nil {
						return fmt.Errorf("failed to auto-generate app-id: %w", err)
					}
					if dryRun {
						fmt.Printf("Auto-generated app-id: %d (new game, dry-run)\n", appID)
					} else {
						fmt.Printf("Auto-generated app-id: %d (new game)\n", appID)
					}
				}
			} else {
				fmt.Printf("Using provided app-id: %d\n", appID)
			}

			// Auto-generate cartridge-id if not provided
			// Note: Even in dry-run, we query the catalog to get correct IDs
			if cartridgeID == 0 {
				fmt.Println("Auto-generating cartridge-id...")
				publisherAddr := sender // Use sender as publisher for filtering
				var err error
				cartridgeID, err = GetMaxCartridgeID(rpc, catalogAddr, publisherAddr, appID)
				if err != nil {
					return fmt.Errorf("failed to auto-generate cartridge-id: %w", err)
				}
				if dryRun {
					fmt.Printf("Auto-generated cartridge-id: %d (dry-run)\n", cartridgeID)
				} else {
					fmt.Printf("Auto-generated cartridge-id: %d\n", cartridgeID)
				}
			}

			// Validate semver format
			semverParts := strings.Split(semver, ".")
			if len(semverParts) != 3 {
				return fmt.Errorf("semver must be in format major.minor.patch (e.g., 1.0.0)")
			}
			var semverBytes [3]uint8
			for i, part := range semverParts {
				val, err := strconv.ParseUint(part, 10, 8)
				if err != nil || val > 255 {
					return fmt.Errorf("invalid semver component: %s (must be 0-255)", part)
				}
				semverBytes[i] = uint8(val)
			}

			// Validate title length
			if len(title) > 16 {
				return fmt.Errorf("title must be <= 16 characters (got %d)", len(title))
			}

			// Defaults
			if schema == 0 {
				schema = 1
			}
			if chunkSize == 0 {
				chunkSize = 51
			}

			// Generate or use cartridge address
			if generateCartAddr {
				fmt.Println("Generating new cartridge address...")
				account, err := rpc.CreateAccount()
				if err != nil {
					return fmt.Errorf("failed to create cartridge account: %w", err)
				}
				cartridgeAddr = account.Address
				fmt.Printf("Generated cartridge address: %s\n", cartridgeAddr)
				logCartridgeUpload(fmt.Sprintf("Generated new cartridge address: %s", cartridgeAddr))
			}

			if cartridgeAddr == "" {
				return fmt.Errorf("cartridge address is required (--cartridge-addr or --generate-cartridge-addr)")
			}

			// Validate cartridge address format
			if !strings.HasPrefix(cartridgeAddr, "NQ") || len(cartridgeAddr) < 42 {
				return fmt.Errorf("invalid cartridge address format: %s", cartridgeAddr)
			}

			// Check file size limit (6MB)
			const maxFileSize = 6 * 1024 * 1024 // 6MB
			fileInfo, err := os.Stat(filePath)
			if err != nil {
				return fmt.Errorf("failed to get file info: %w", err)
			}
			if fileInfo.Size() > maxFileSize {
				return fmt.Errorf("file size (%d bytes) exceeds maximum allowed size of 6MB (%d bytes)", fileInfo.Size(), maxFileSize)
			}

			// Read file and calculate SHA256
			fileData, err := os.ReadFile(filePath)
			if err != nil {
				return fmt.Errorf("failed to read file: %w", err)
			}

			sha256Hash, err := CalculateFileSHA256(filePath)
			if err != nil {
				return fmt.Errorf("failed to calculate SHA256: %w", err)
			}

			totalSize := uint64(len(fileData))
			expectedChunks := int((totalSize + uint64(chunkSize) - 1) / uint64(chunkSize))

			fmt.Printf("\n=== Upload Configuration ===\n")
			fmt.Printf("File: %s\n", filePath)
			fmt.Printf("Size: %d bytes\n", totalSize)
			fmt.Printf("SHA256: %s\n", hex.EncodeToString(sha256Hash[:]))
			fmt.Printf("Expected chunks: %d\n", expectedChunks)
			fmt.Printf("App ID: %d\n", appID)
			fmt.Printf("Cartridge ID: %d\n", cartridgeID)
			fmt.Printf("Cartridge Address: %s\n", cartridgeAddr)
			fmt.Printf("Catalog Address: %s\n", catalogAddr)
			fmt.Printf("===========================\n\n")

			// Log upload start
			logCartridgeUpload("=== Upload Started ===")
			logCartridgeUpload("File: " + filePath)
			logCartridgeUpload(fmt.Sprintf("Size: %d bytes", totalSize))
			logCartridgeUpload(fmt.Sprintf("SHA256: %s", hex.EncodeToString(sha256Hash[:])))
			logCartridgeUpload(fmt.Sprintf("App ID: %d", appID))
			logCartridgeUpload(fmt.Sprintf("Cartridge ID: %d", cartridgeID))
			logCartridgeUpload(fmt.Sprintf("Title: %s", title))
			logCartridgeUpload(fmt.Sprintf("Semver: %s", semver))
			logCartridgeUpload(fmt.Sprintf("Platform: %d", platform))
			logCartridgeUpload(fmt.Sprintf("Cartridge Address: %s", cartridgeAddr))
			logCartridgeUpload(fmt.Sprintf("Catalog Address: %s", catalogAddr))
			logCartridgeUpload(fmt.Sprintf("Sender: %s", sender))
			logCartridgeUpload(fmt.Sprintf("RPC URL: %s", rpcURL))
			logCartridgeUpload(fmt.Sprintf("Expected chunks: %d", expectedChunks))

			// Load or create progress (include app-id in filename to avoid conflicts)
			progressFile := fmt.Sprintf("upload_cartridge_%d_%d.json", appID, cartridgeID)
			progress := &CartridgeUploadProgress{
				AppID:         appID,
				CartridgeID:   cartridgeID,
				CartridgeAddr: cartridgeAddr,
				TotalChunks:   expectedChunks,
				SentChunks:    0,
				Plan:          make([]UploadPlan, 0, expectedChunks),
			}

			// Try to load existing progress, but validate it matches current upload
			if data, err := os.ReadFile(progressFile); err == nil {
				var loadedProgress CartridgeUploadProgress
				if err := json.Unmarshal(data, &loadedProgress); err == nil {
					// Only use loaded progress if it matches current upload
					if loadedProgress.AppID == appID && loadedProgress.CartridgeID == cartridgeID &&
						loadedProgress.CartridgeAddr == cartridgeAddr && loadedProgress.TotalChunks == expectedChunks {
						progress = &loadedProgress
						fmt.Printf("Resuming from progress file: %s\n", progressFile)
					} else {
						fmt.Printf("Progress file exists but doesn't match current upload. Starting fresh.\n")
					}
				}
			}

			var txSender TxSender
			if dryRun {
				txSender = &DryRunSender{}
			} else {
				// Check consensus before proceeding
				consensus, err := rpc.IsConsensusEstablished()
				if err != nil {
					return fmt.Errorf("failed to check consensus: %w", err)
				}
				if !consensus {
					return fmt.Errorf("node does not have consensus with the network - cannot upload. Wait for sync or use --dry-run")
				}

				// Create RPC sender for cartridge address (will be used for CART and DATA)
				fmt.Printf("Sending transactions from %s\n", sender)
				rpcSender, err := NewRPCSender(rpcURL, sender, cartridgeAddr, fee)
				if err != nil {
					return fmt.Errorf("failed to initialize RPC sender: %w", err)
				}
				txSender = rpcSender
			}

			// Validate and cap concurrency
			if concurrency < 1 {
				concurrency = 1
			}
			if concurrency > 10 {
				concurrency = 10
			}

			// Use burst size equal to concurrency for smoother parallel uploads
			limiter := rate.NewLimiter(rate.Limit(rateLimit), concurrency)

			// Step 1: Send DATA chunks FIRST
			// (CART header is sent AFTER all chunks so it appears in newest transactions for faster loading)
			fmt.Printf("\n=== Step 1: Uploading DATA chunks (concurrency: %d) ===\n", concurrency)

			// fileData was already read earlier for SHA256 calculation - reuse it
			// Build list of chunks to upload (skip already sent)
			type chunkWork struct {
				index uint32
				data  []byte
			}
			var chunksToUpload []chunkWork
			sentHashes := make(map[uint32]string) // index -> txHash for already sent

			for _, plan := range progress.Plan {
				if plan.TxHash != "" {
					sentHashes[plan.Index] = plan.TxHash
				}
			}

			for i := 0; i < len(fileData); i += int(chunkSize) {
				end := i + int(chunkSize)
				if end > len(fileData) {
					end = len(fileData)
				}
				chunkIdx := uint32(i / int(chunkSize))

				if txHash, ok := sentHashes[chunkIdx]; ok {
					fmt.Printf("Skipping chunk %d (already sent: %s)\n", chunkIdx, txHash[:16])
					continue
				}

				chunkData := make([]byte, end-i)
				copy(chunkData, fileData[i:end])
				chunksToUpload = append(chunksToUpload, chunkWork{index: chunkIdx, data: chunkData})
			}

			fmt.Printf("Chunks to upload: %d (already sent: %d)\n", len(chunksToUpload), len(sentHashes))

			if len(chunksToUpload) > 0 {
				// Create worker pool for parallel uploads
				var wg sync.WaitGroup
				var mu sync.Mutex
				var sentCount int64
				var failedCount int64
				startTime := time.Now()

				// Create work channel
				workChan := make(chan chunkWork, len(chunksToUpload))
				for _, chunk := range chunksToUpload {
					workChan <- chunk
				}
				close(workChan)

				// Start workers
				for w := 0; w < concurrency; w++ {
					wg.Add(1)
					go func(workerID int) {
						defer wg.Done()

						for chunk := range workChan {
							// Rate limit
							if err := limiter.Wait(cmd.Context()); err != nil {
								return
							}

							dataPayload := DATAPayload{
								CartridgeID: cartridgeID,
								ChunkIndex:  chunk.index,
								Length:      uint8(len(chunk.data)),
								Data:        chunk.data,
							}

							encoded, err := EncodeDATA(dataPayload)
							if err != nil {
								fmt.Printf("[W%d] Failed to encode chunk %d: %v\n", workerID, chunk.index, err)
								atomic.AddInt64(&failedCount, 1)
								mu.Lock()
								progress.FailedChunks = append(progress.FailedChunks, int(chunk.index))
								mu.Unlock()
								continue
							}

							txHash, err := txSender.SendTransaction(encoded)
							if err != nil {
								fmt.Printf("[W%d] Failed to send chunk %d: %v\n", workerID, chunk.index, err)
								atomic.AddInt64(&failedCount, 1)
								mu.Lock()
								progress.FailedChunks = append(progress.FailedChunks, int(chunk.index))
								mu.Unlock()
								continue
							}

							// Update progress (thread-safe)
							mu.Lock()
							progress.Plan = append(progress.Plan, UploadPlan{
								Index:   chunk.index,
								Payload: hex.EncodeToString(encoded),
								TxHash:  txHash,
							})
							progress.SentChunks++
							currentSent := progress.SentChunks
							mu.Unlock()

							sent := atomic.AddInt64(&sentCount, 1)
							elapsed := time.Since(startTime).Seconds()
							rate := float64(sent) / elapsed
							remaining := float64(len(chunksToUpload)-int(sent)) / rate

							fmt.Printf("[W%d] Sent chunk %d/%d (%.1f tx/s, ETA: %.0fs)\n",
								workerID, currentSent, expectedChunks, rate, remaining)

							// Save progress periodically (every 10 successful sends across all workers)
							if sent%10 == 0 {
								mu.Lock()
								saveCartridgeProgress(progressFile, progress)
								mu.Unlock()
							}

							// Log every 100 chunks
							if sent%100 == 0 {
								logCartridgeUpload(fmt.Sprintf("Progress: %d/%d chunks sent (%.1f tx/s)", currentSent, expectedChunks, rate))
							}
						}
					}(w)
				}

				// Wait for all workers to complete
				wg.Wait()

				elapsed := time.Since(startTime).Seconds()
				finalRate := float64(sentCount) / elapsed
				fmt.Printf("\n✓ Uploaded %d chunks in %.1fs (%.1f tx/s avg)\n", sentCount, elapsed, finalRate)

				if failedCount > 0 {
					fmt.Printf("⚠️  %d chunks failed - run again to retry\n", failedCount)
				}
			}

			// Final save
			saveCartridgeProgress(progressFile, progress)

			// Step 2: Send CART header AFTER all chunks (so it's in newest transactions for faster loading)
			if progress.SentChunks == progress.TotalChunks && progress.CARTTxHash == "" {
				fmt.Println("\n=== Step 2: Uploading CART header ===")
				cartHeader := CARTHeader{
					Schema:      schema,
					Platform:    platform,
					ChunkSize:   chunkSize,
					Flags:       0,
					CartridgeID: cartridgeID,
					TotalSize:   totalSize,
					SHA256:      sha256Hash,
				}

				cartPayload, err := EncodeCART(cartHeader)
				if err != nil {
					return fmt.Errorf("failed to encode CART header: %w", err)
				}

				if err := limiter.Wait(cmd.Context()); err != nil {
					return err
				}

				txHash, err := txSender.SendTransaction(cartPayload)
				if err != nil {
					return fmt.Errorf("failed to send CART header: %w", err)
				}

				progress.CARTTxHash = txHash
				fmt.Printf("✓ CART header sent: %s\n", txHash)
				saveCartridgeProgress(progressFile, progress)
				logCartridgeUpload(fmt.Sprintf("CART header sent: %s", txHash))
			} else if progress.CARTTxHash != "" {
				fmt.Printf("CART header already sent: %s\n", progress.CARTTxHash)
			}

			// Step 3: Send CENT entry to catalog if all chunks AND CART header are uploaded
			if progress.SentChunks == progress.TotalChunks && progress.CARTTxHash != "" && progress.CENTTxHash == "" {
				fmt.Println("\n=== Step 3: Registering cartridge in catalog (CENT) ===")

				// Convert cartridge address to bytes
				cartAddrBytes, err := AddressNQToBytes(cartridgeAddr)
				if err != nil {
					return fmt.Errorf("failed to convert cartridge address: %w", err)
				}

				centEntry := CENTEntry{
					Schema:        schema,
					Platform:      platform,
					Flags:         0,
					AppID:         appID,
					Semver:        semverBytes,
					CartridgeAddr: cartAddrBytes,
					TitleShort:    title,
				}

				centPayload, err := EncodeCENT(centEntry)
				if err != nil {
					return fmt.Errorf("failed to encode CENT entry: %w", err)
				}

				// Create sender for catalog address
				var catalogSender TxSender
				if dryRun {
					catalogSender = &DryRunSender{}
				} else {
					if err := limiter.Wait(cmd.Context()); err != nil {
						return err
					}

					catalogRpcSender, err := NewRPCSender(rpcURL, sender, catalogAddr, fee)
					if err != nil {
						return fmt.Errorf("failed to initialize catalog RPC sender: %w", err)
					}
					catalogSender = catalogRpcSender
				}

				txHash, err := catalogSender.SendTransaction(centPayload)
				if err != nil {
					return fmt.Errorf("failed to send CENT entry: %w", err)
				}

				progress.CENTTxHash = txHash
				fmt.Printf("✓ CENT entry sent to catalog: %s\n", txHash)
				saveCartridgeProgress(progressFile, progress)
				logCartridgeUpload(fmt.Sprintf("CENT entry sent to catalog: %s", txHash))
			} else if progress.CENTTxHash != "" {
				fmt.Printf("CENT entry already sent: %s\n", progress.CENTTxHash)
			} else {
				fmt.Printf("\n⚠️  Not all chunks uploaded yet (%d/%d). CENT entry will be sent when complete.\n", progress.SentChunks, progress.TotalChunks)
			}

			if dryRun {
				fmt.Printf("\nDry-run complete. Upload plan saved to %s\n", progressFile)
			} else {
				fmt.Printf("\n✓ Upload complete!\n")
				fmt.Printf("  CART header: %s\n", progress.CARTTxHash)
				fmt.Printf("  DATA chunks: %d/%d\n", progress.SentChunks, progress.TotalChunks)
				if progress.CENTTxHash != "" {
					fmt.Printf("  CENT entry: %s\n", progress.CENTTxHash)
				}
				if len(progress.FailedChunks) > 0 {
					fmt.Printf("  Failed chunks: %v\n", progress.FailedChunks)
				}

				// Log upload completion
				logCartridgeUpload("=== Upload Complete ===")
				logCartridgeUpload("CART header: " + progress.CARTTxHash)
				logCartridgeUpload(fmt.Sprintf("DATA chunks: %d/%d", progress.SentChunks, progress.TotalChunks))
				if progress.CENTTxHash != "" {
					logCartridgeUpload(fmt.Sprintf("CENT entry: %s", progress.CENTTxHash))
				}
				if len(progress.FailedChunks) > 0 {
					logCartridgeUpload(fmt.Sprintf("Failed chunks: %v", progress.FailedChunks))
				}
				logCartridgeUpload("") // Empty line for readability
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&filePath, "file", "", "Path to file to upload (required)")
	cmd.Flags().Uint32Var(&appID, "app-id", 0, "App ID (uint32, auto-generated if not provided)")
	cmd.Flags().Uint32Var(&cartridgeID, "cartridge-id", 0, "Cartridge ID (uint32, auto-generated if not provided)")
	cmd.Flags().StringVar(&title, "title", "", "Short title (max 16 chars, required)")
	cmd.Flags().StringVar(&semver, "semver", "", "Semantic version (e.g., 1.0.0, required)")
	cmd.Flags().Uint8Var(&platform, "platform", 0, "Platform code: 0=DOS, 1=GB, 2=GBC, 3=NES (default: 0)")
	cmd.Flags().StringVar(&cartridgeAddr, "cartridge-addr", "", "Cartridge address (NQ..., or use --generate-cartridge-addr)")
	cmd.Flags().BoolVar(&generateCartAddr, "generate-cartridge-addr", false, "Generate a new cartridge address")
	cmd.Flags().StringVar(&catalogAddr, "catalog-addr", "", "Catalog address (NQ..., 'main', 'test', required)")
	cmd.Flags().StringVar(&sender, "sender", "", "Sender address (defaults to ADDRESS from account_credentials.txt)")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Dry-run mode (output plan file only)")
	cmd.Flags().Float64Var(&rateLimit, "rate", 25.0, "Transaction rate limit (tx/s, default: 25)")
	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().Int64Var(&fee, "fee", 0, "Transaction fee in Luna (default: 0, minimum)")
	cmd.Flags().Uint8Var(&schema, "schema", 1, "Schema version (default: 1)")
	cmd.Flags().Uint8Var(&chunkSize, "chunk-size", 51, "Chunk size in bytes (default: 51)")
	cmd.Flags().IntVar(&concurrency, "concurrency", 1, "Number of parallel upload workers (default: 1, max: 10)")

	cmd.MarkFlagRequired("file")
	cmd.MarkFlagRequired("title")
	cmd.MarkFlagRequired("semver")
	cmd.MarkFlagRequired("catalog-addr")

	return cmd
}

func saveCartridgeProgress(filename string, progress *CartridgeUploadProgress) {
	data, err := json.MarshalIndent(progress, "", "  ")
	if err != nil {
		fmt.Printf("Warning: failed to marshal progress: %v\n", err)
		return
	}
	if err := os.WriteFile(filename, data, 0644); err != nil {
		fmt.Printf("Warning: failed to save progress: %v\n", err)
	}
}

// logCartridgeUpload writes upload information to upload_cartridge.log
func logCartridgeUpload(message string) {
	logFile := "upload_cartridge.log"
	file, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		// Silently fail - don't interrupt upload if logging fails
		return
	}
	defer file.Close()

	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logger := log.New(file, "", 0)
	logger.Printf("[%s] %s", timestamp, message)
}

// resolveCatalogAddress resolves catalog address shortcuts to actual addresses
func resolveCatalogAddress(addr string) string {
	switch strings.ToLower(addr) {
	case "main":
		return "NQ15 NXMP 11A0 TMKP G1Q8 4ABD U16C XD6Q D948"
	case "test":
		return "NQ32 0VD4 26TR 1394 KXBJ 862C NFKG 61M5 GFJ0"
	default:
		// Return as-is (assumed to be a full NQ address)
		return addr
	}
}
