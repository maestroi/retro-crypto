package main

// ==============================================================================
// LEGACY CODE - DEPRECATED
// ==============================================================================
// This file contains the old upload command using the "DOOM" magic format.
// It has been replaced by upload_cartridge.go which uses the new CART/DATA/CENT
// format for better organization and catalog support.
//
// This code is kept for backwards compatibility with existing uploads.
// For new uploads, use: nimiq-uploader upload-cartridge
// ==============================================================================

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"golang.org/x/time/rate"
)

type UploadPlan struct {
	Index   uint32 `json:"idx"`
	Payload string `json:"payload_hex"`
	TxHash  string `json:"tx_hash,omitempty"` // Transaction hash where this chunk was sent
}

type UploadProgress struct {
	GameID       uint32       `json:"game_id"`
	TotalChunks  int          `json:"total_chunks"`
	SentChunks   int          `json:"sent_chunks"`
	FailedChunks []int        `json:"failed_chunks,omitempty"`
	Plan         []UploadPlan `json:"plan"`
}

func newUploadCmd() *cobra.Command {
	var (
		filePath         string
		gameID           uint32
		sender           string
		receiver         string
		dryRun           bool
		rateLimit        float64
		rpcURL           string
		fee              int64
		generateManifest bool
		manifestOutput   string
		network          string
		title            string // Display title of the game
		platform         string // Platform (e.g., "DOS", "Windows")
	)

	cmd := &cobra.Command{
		Use:   "upload",
		Short: "Upload a file as DOOM chunks to Nimiq",
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

			// Default receiver address if not provided
			if receiver == "" {
				receiver = "NQ27 21G6 9BG1 JBHJ NUFA YVJS 1R6C D2X0 QAES"
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

			chunks, err := ChunkFile(filePath, gameID)
			if err != nil {
				return fmt.Errorf("failed to chunk file: %w", err)
			}

			fmt.Printf("Created %d chunks for game_id=%d\n", len(chunks), gameID)

			progress := &UploadProgress{
				GameID:      gameID,
				TotalChunks: len(chunks),
				SentChunks:  0,
				Plan:        make([]UploadPlan, 0, len(chunks)),
			}

			// Load existing progress if available
			progressFile := fmt.Sprintf("upload_progress_%d.json", gameID)
			if data, err := os.ReadFile(progressFile); err == nil {
				json.Unmarshal(data, progress)
			}

			var txSender TxSender
			if dryRun {
				txSender = &DryRunSender{}
			} else {
				// Check consensus before proceeding
				rpc := NewNimiqRPC(rpcURL)
				consensus, err := rpc.IsConsensusEstablished()
				if err != nil {
					return fmt.Errorf("failed to check consensus: %w", err)
				}
				if !consensus {
					return fmt.Errorf("node does not have consensus with the network - cannot upload. Wait for sync or use --dry-run")
				}

				// Create RPC sender (will check account status)
				fmt.Printf("Sending transactions from %s to %s\n", sender, receiver)
				rpcSender, err := NewRPCSender(rpcURL, sender, receiver, fee)
				if err != nil {
					return fmt.Errorf("failed to initialize RPC sender: %w", err)
				}
				txSender = rpcSender
			}

			limiter := rate.NewLimiter(rate.Limit(rateLimit), 1)

			for i, chunk := range chunks {
				// Check if already sent
				var existingPlan *UploadPlan
				for j := range progress.Plan {
					if progress.Plan[j].Index == chunk.Index {
						existingPlan = &progress.Plan[j]
						break
					}
				}
				if existingPlan != nil {
					if existingPlan.TxHash != "" {
						fmt.Printf("Skipping chunk %d (already sent in tx: %s)\n", chunk.Index, existingPlan.TxHash)
					} else {
						fmt.Printf("Skipping chunk %d (already sent)\n", chunk.Index)
					}
					continue
				}

				// Rate limit
				if err := limiter.Wait(cmd.Context()); err != nil {
					return err
				}

				payload, err := EncodePayload(chunk)
				if err != nil {
					return fmt.Errorf("failed to encode chunk %d: %w", i, err)
				}

				txHash, err := txSender.SendTransaction(payload)
				if err != nil {
					fmt.Printf("Failed to send chunk %d: %v\n", chunk.Index, err)
					progress.FailedChunks = append(progress.FailedChunks, int(chunk.Index))
					continue
				}

				progress.Plan = append(progress.Plan, UploadPlan{
					Index:   chunk.Index,
					Payload: hex.EncodeToString(payload),
					TxHash:  txHash,
				})
				progress.SentChunks++

				fmt.Printf("Sent chunk %d/%d (tx: %s)\n", i+1, len(chunks), txHash)

				// Save progress periodically
				if (i+1)%10 == 0 {
					saveProgress(progressFile, progress)
				}
			}

			// Final save
			saveProgress(progressFile, progress)

			if dryRun {
				// Write upload plan
				planFile := "upload_plan.jsonl"
				file, err := os.Create(planFile)
				if err != nil {
					return fmt.Errorf("failed to create plan file: %w", err)
				}
				defer file.Close()

				encoder := json.NewEncoder(file)
				for _, plan := range progress.Plan {
					if err := encoder.Encode(plan); err != nil {
						return fmt.Errorf("failed to write plan: %w", err)
					}
				}

				fmt.Printf("\nDry-run complete. Upload plan written to %s\n", planFile)
				fmt.Printf("Total chunks: %d\n", len(progress.Plan))
			} else {
				fmt.Printf("\nUpload complete. Sent %d/%d chunks\n", progress.SentChunks, progress.TotalChunks)
				if len(progress.FailedChunks) > 0 {
					fmt.Printf("Failed chunks: %v\n", progress.FailedChunks)
				}

				// Generate manifest automatically after successful upload
				if generateManifest {
					if err := generateManifestAfterUpload(filePath, gameID, sender, network, manifestOutput, progressFile, title, platform); err != nil {
						fmt.Printf("Warning: Failed to generate manifest: %v\n", err)
					} else {
						fmt.Printf("\n✓ Manifest generated: %s\n", manifestOutput)
					}
				}
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&filePath, "file", "", "Path to file to upload (required)")
	cmd.Flags().Uint32Var(&gameID, "game-id", 0, "Game ID (uint32) (required)")
	cmd.Flags().StringVar(&sender, "sender", "", "Sender address (defaults to ADDRESS from account_credentials.txt)")
	cmd.Flags().StringVar(&receiver, "receiver", "NQ27 21G6 9BG1 JBHJ NUFA YVJS 1R6C D2X0 QAES", "Receiver address for data transactions")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Dry-run mode (output plan file only)")
	cmd.Flags().Float64Var(&rateLimit, "rate", 1.0, "Transaction rate limit (tx/s)")
	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().Int64Var(&fee, "fee", 0, "Transaction fee in Luna (default: 0, minimum)")
	cmd.Flags().BoolVar(&generateManifest, "manifest", true, "Generate manifest.json after upload completes")
	cmd.Flags().StringVar(&manifestOutput, "manifest-output", "", "Manifest output file (default: manifest.json)")
	cmd.Flags().StringVar(&network, "network", "", "Network for manifest (mainnet/testnet) (or set NIMIQ_NETWORK)")
	cmd.Flags().StringVar(&title, "title", "", "Display title of the game (e.g., \"Digger Remastered\")")
	cmd.Flags().StringVar(&platform, "platform", "", "Platform (e.g., \"DOS\", \"Windows\", \"Linux\")")

	cmd.MarkFlagRequired("file")
	cmd.MarkFlagRequired("game-id")

	return cmd
}

func saveProgress(filename string, progress *UploadProgress) {
	data, err := json.MarshalIndent(progress, "", "  ")
	if err != nil {
		fmt.Printf("Warning: failed to marshal progress: %v\n", err)
		return
	}
	if err := os.WriteFile(filename, data, 0644); err != nil {
		fmt.Printf("Warning: failed to save progress: %v\n", err)
	}
}

func generateManifestAfterUpload(filePath string, gameID uint32, sender string, network string, output string, progressFile string, title string, platform string) error {
	// Determine network
	if network == "" {
		network = os.Getenv("NIMIQ_NETWORK")
		if network == "" {
			network = "mainnet" // default to mainnet
		}
	}

	// Read file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	// Calculate SHA256
	hash := sha256.Sum256(data)
	sha256Hex := fmt.Sprintf("%x", hash)

	// Get filename
	filename := filePath
	if info, err := os.Stat(filePath); err == nil {
		filename = info.Name()
	}

	manifest := Manifest{
		GameID:        gameID,
		Title:         title,
		Platform:      platform,
		Filename:      filename,
		Executable:    "", // Can be set manually after manifest generation
		TotalSize:     uint64(len(data)),
		ChunkSize:     51,
		SHA256:        sha256Hex,
		SenderAddress: sender,
		Network:       network,
	}

	// Load transaction hashes from progress file
	if progressData, err := os.ReadFile(progressFile); err == nil {
		var progress struct {
			Plan []struct {
				TxHash string `json:"tx_hash"`
			} `json:"plan"`
		}
		if err := json.Unmarshal(progressData, &progress); err == nil {
			// Extract transaction hashes from progress file
			var txHashes []string
			for _, planItem := range progress.Plan {
				if planItem.TxHash != "" {
					txHashes = append(txHashes, planItem.TxHash)
				}
			}
			if len(txHashes) > 0 {
				manifest.ExpectedTxHashes = txHashes
			}
		}
	}

	// Determine output filename
	if output == "" {
		output = "manifest.json"
	}

	// Write manifest
	manifestJSON, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal manifest: %w", err)
	}

	if err := os.WriteFile(output, manifestJSON, 0644); err != nil {
		return fmt.Errorf("failed to write manifest: %w", err)
	}

	return nil
}
