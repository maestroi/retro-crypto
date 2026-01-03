package main

// ==============================================================================
// LEGACY CODE - DEPRECATED
// ==============================================================================
// This file generates old-style manifest.json files for the DOOM format.
// The new cartridge format (CART/DATA/CENT) doesn't require a separate manifest
// because all metadata is stored on-chain in the CART header and CENT entry.
//
// This code is kept for backwards compatibility with existing tools.
// ==============================================================================

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

type Manifest struct {
	GameID           uint32   `json:"game_id"`
	Title            string   `json:"title,omitempty"`    // Display name of the game (e.g., "Digger Remastered")
	Platform         string   `json:"platform,omitempty"` // Platform (e.g., "DOS", "Windows", "Linux")
	Filename         string   `json:"filename"`
	Executable       string   `json:"executable,omitempty"` // Optional: specifies which .exe/.com/.bat to run
	TotalSize        uint64   `json:"total_size"`
	ChunkSize        int      `json:"chunk_size"`
	SHA256           string   `json:"sha256"`
	SenderAddress    string   `json:"sender_address"`
	Network          string   `json:"network"`
	StartHeight      *int64   `json:"start_height,omitempty"`
	EndHeight        *int64   `json:"end_height,omitempty"`
	ExpectedTxHashes []string `json:"expected_tx_hashes,omitempty"` // Transaction hashes that should contain chunks
}

func newManifestCmd() *cobra.Command {
	var (
		filePath     string
		gameID       uint32
		sender       string
		network      string
		output       string
		progressFile string // Path to upload_progress_*.json file
		title        string // Display title of the game
		platform     string // Platform (e.g., "DOS", "Windows")
	)

	cmd := &cobra.Command{
		Use:   "manifest",
		Short: "Generate manifest.json for a file",
		RunE: func(cmd *cobra.Command, args []string) error {
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

			// Try to load transaction hashes from upload progress file
			if progressFile == "" {
				// Try default progress file name
				progressFile = fmt.Sprintf("upload_progress_%d.json", gameID)
			}

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
						fmt.Printf("  Loaded %d transaction hashes from %s\n", len(txHashes), progressFile)
					}
				}
			} else {
				// Progress file not found is not an error, just skip it
				fmt.Printf("  Note: No upload progress file found at %s (expected_tx_hashes will be empty)\n", progressFile)
			}

			// Write manifest
			manifestJSON, err := json.MarshalIndent(manifest, "", "  ")
			if err != nil {
				return fmt.Errorf("failed to marshal manifest: %w", err)
			}

			if output == "" {
				output = "manifest.json"
			}

			if err := os.WriteFile(output, manifestJSON, 0644); err != nil {
				return fmt.Errorf("failed to write manifest: %w", err)
			}

			fmt.Printf("Manifest written to %s\n", output)
			fmt.Printf("  Game ID: %d\n", manifest.GameID)
			fmt.Printf("  Filename: %s\n", manifest.Filename)
			fmt.Printf("  Total Size: %d bytes\n", manifest.TotalSize)
			fmt.Printf("  SHA256: %s\n", manifest.SHA256)
			fmt.Printf("  Sender: %s\n", manifest.SenderAddress)
			fmt.Printf("  Network: %s\n", manifest.Network)

			return nil
		},
	}

	cmd.Flags().StringVar(&filePath, "file", "", "Path to file (required)")
	cmd.Flags().Uint32Var(&gameID, "game-id", 0, "Game ID (uint32) (required)")
	cmd.Flags().StringVar(&sender, "sender", "", "Sender address (required)")
	cmd.Flags().StringVar(&network, "network", "", "Network (mainnet/testnet) (or set NIMIQ_NETWORK)")
	cmd.Flags().StringVar(&output, "output", "manifest.json", "Output manifest file")
	cmd.Flags().StringVar(&progressFile, "progress-file", "", "Path to upload_progress_*.json file (defaults to upload_progress_{game-id}.json)")
	cmd.Flags().StringVar(&title, "title", "", "Display title of the game (e.g., \"Digger Remastered\")")
	cmd.Flags().StringVar(&platform, "platform", "", "Platform (e.g., \"DOS\", \"Windows\", \"Linux\")")

	cmd.MarkFlagRequired("file")
	cmd.MarkFlagRequired("game-id")
	cmd.MarkFlagRequired("sender")

	return cmd
}
