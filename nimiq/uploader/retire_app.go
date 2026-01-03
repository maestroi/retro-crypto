package main

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"

	"github.com/spf13/cobra"
	"golang.org/x/time/rate"
)

func newRetireAppCmd() *cobra.Command {
	var (
		appID       uint32
		catalogAddr string
		sender      string
		dryRun      bool
		rateLimit   float64
		rpcURL      string
		fee         int64
		schema      uint8
	)

	cmd := &cobra.Command{
		Use:   "retire-app",
		Short: "Retire an app by sending a CENT entry with the retired flag set",
		Long: `Retire an app by sending a CENT entry to the catalog with the retired flag set.
This will mark the app as retired, and it will be filtered out from catalog listings.

The command will:
1. Query the catalog to find the latest version of the app
2. Send a new CENT entry with the retired flag set (same app-id, semver, and cartridge address)
3. The frontend will automatically filter out retired apps`,
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

			if appID == 0 {
				return fmt.Errorf("app-id is required (--app-id)")
			}

			// Resolve catalog address shortcuts
			catalogAddr = resolveCatalogAddress(catalogAddr)

			// Initialize RPC
			rpc := NewNimiqRPC(rpcURL)

			// Find the latest version of this app
			normalizedPublisher := normalizeAddress(sender)
			transactions, err := GetAllTransactionsByAddress(rpc, normalizeAddress(catalogAddr), 500)
			if err != nil {
				return fmt.Errorf("failed to query catalog: %w", err)
			}

			// Find the latest CENT entry for this app-id
			var latestEntry *CENTEntry
			var latestHeight int64
			var latestSemver [3]uint8

			for _, tx := range transactions {
				// Filter by publisher
				if normalizeAddress(tx.From) != normalizedPublisher {
					continue
				}

				// Parse CENT entry
				dataHex := tx.Data
				if dataHex == "" {
					dataHex = tx.RecipientData
				}
				if dataHex == "" {
					dataHex = tx.SenderData
				}
				if dataHex == "" {
					continue
				}

				data, err := hex.DecodeString(dataHex)
				if err != nil || len(data) < 64 {
					continue
				}

				// Check magic
				if string(data[0:4]) != MagicCENT {
					continue
				}

				// Parse app-id
				centAppID := binary.LittleEndian.Uint32(data[7:11])
				if centAppID != appID {
					continue
				}

				// Check if already retired
				flags := data[6]
				if flags&FlagRetired != 0 {
					fmt.Printf("App ID %d is already retired\n", appID)
					if !dryRun {
						return nil
					}
				}

				// Parse semver and height
				semver := [3]uint8{data[11], data[12], data[13]}
				height := tx.Height
				if height == 0 {
					height = tx.BlockNumber
				}

				// Check if this is the latest version
				if latestEntry == nil || height > latestHeight {
					// Extract cartridge address
					var cartAddr [20]byte
					copy(cartAddr[:], data[14:34])

					// Extract title
					titleBytes := data[34:50]
					title := ""
					for i := 0; i < 16; i++ {
						if titleBytes[i] == 0 {
							break
						}
						title += string(titleBytes[i])
					}

					latestEntry = &CENTEntry{
						Schema:        data[4],
						Platform:      data[5],
						Flags:         flags | FlagRetired, // Set retired flag
						AppID:         appID,
						Semver:        semver,
						CartridgeAddr: cartAddr,
						TitleShort:    title,
					}
					latestHeight = height
					latestSemver = semver
				}
			}

			if latestEntry == nil {
				return fmt.Errorf("app ID %d not found in catalog", appID)
			}

			fmt.Printf("=== Retire App ===\n")
			fmt.Printf("App ID: %d\n", appID)
			fmt.Printf("Latest Version: %d.%d.%d\n", latestSemver[0], latestSemver[1], latestSemver[2])
			fmt.Printf("Catalog Address: %s\n", catalogAddr)
			fmt.Printf("Sender: %s\n", sender)
			fmt.Printf("RPC URL: %s\n", rpcURL)
			fmt.Printf("\n")

			if dryRun {
				fmt.Printf("Dry-run: Would send CENT entry with retired flag set\n")
				return nil
			}

			// Encode CENT entry with retired flag
			centPayload, err := EncodeCENT(*latestEntry)
			if err != nil {
				return fmt.Errorf("failed to encode CENT entry: %w", err)
			}

			// Create sender
			limiter := rate.NewLimiter(rate.Limit(rateLimit), 1)
			if err := limiter.Wait(cmd.Context()); err != nil {
				return err
			}

			catalogRpcSender, err := NewRPCSender(rpcURL, sender, catalogAddr, fee)
			if err != nil {
				return fmt.Errorf("failed to initialize RPC sender: %w", err)
			}

			txHash, err := catalogRpcSender.SendTransaction(centPayload)
			if err != nil {
				return fmt.Errorf("failed to send CENT entry: %w", err)
			}

			fmt.Printf("✓ CENT entry sent with retired flag: %s\n", txHash)
			fmt.Printf("\nApp ID %d is now retired and will be filtered out from catalog listings.\n", appID)

			return nil
		},
	}

	cmd.Flags().Uint32Var(&appID, "app-id", 0, "App ID to retire (required)")
	cmd.Flags().StringVar(&catalogAddr, "catalog-addr", "", "Catalog address (NQ..., 'main', 'test', required)")
	cmd.Flags().StringVar(&sender, "sender", "", "Sender address (defaults to ADDRESS from account_credentials.txt)")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "Dry-run mode (show what would be sent)")
	cmd.Flags().Float64Var(&rateLimit, "rate", 25.0, "Transaction rate limit (tx/s, default: 25)")
	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().Int64Var(&fee, "fee", 0, "Transaction fee in Luna (default: 0, minimum)")
	cmd.Flags().Uint8Var(&schema, "schema", 1, "Schema version (default: 1)")

	cmd.MarkFlagRequired("app-id")
	cmd.MarkFlagRequired("catalog-addr")

	return cmd
}

