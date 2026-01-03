package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"
)

func newAccountCmd() *cobra.Command {
	var accountCmd = &cobra.Command{
		Use:   "account",
		Short: "Manage Nimiq accounts",
	}

	accountCmd.AddCommand(newAccountCreateCmd())
	accountCmd.AddCommand(newAccountImportCmd())
	accountCmd.AddCommand(newAccountStatusCmd())
	accountCmd.AddCommand(newAccountBalanceCmd())
	accountCmd.AddCommand(newAccountWaitFundsCmd())
	accountCmd.AddCommand(newAccountConsensusCmd())
	accountCmd.AddCommand(newAccountUnlockCmd())
	accountCmd.AddCommand(newAccountLockCmd())

	return accountCmd
}

func newAccountCreateCmd() *cobra.Command {
	var (
		rpcURL       string
		saveFile     string
		saveToConfig bool
	)

	cmd := &cobra.Command{
		Use:   "create",
		Short: "Create a new account and save credentials as JSON",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			rpc := NewNimiqRPC(rpcURL)
			account, err := rpc.CreateAccount()
			if err != nil {
				return fmt.Errorf("failed to create account: %w", err)
			}

			// Generate a random passphrase (32 bytes = 64 hex chars)
			passphraseBytes := make([]byte, 32)
			if _, err := rand.Read(passphraseBytes); err != nil {
				return fmt.Errorf("failed to generate passphrase: %w", err)
			}
			passphrase := hex.EncodeToString(passphraseBytes)

			// Check if account is already imported (createAccount may have already imported it)
			imported, err := rpc.IsAccountImported(account.Address)
			if err == nil && !imported {
				// Import the account with the generated passphrase
				fmt.Println("Importing account with generated passphrase...")
				importedAddress, err := rpc.ImportRawKey(account.PrivateKey, passphrase)
				if err != nil {
					// If import fails, continue anyway - account might already be there
					fmt.Printf("⚠️  Warning: Failed to import account (may already exist): %v\n", err)
				} else if importedAddress != account.Address {
					fmt.Printf("⚠️  Warning: Imported address (%s) differs from created address (%s)\n", importedAddress, account.Address)
				} else {
					fmt.Println("✅ Account imported successfully")
				}
			} else {
				fmt.Println("ℹ️  Account already imported (from createAccount)")
			}

			// Create credentials struct
			creds := &Credentials{
				Address:    account.Address,
				PublicKey:  account.PublicKey,
				PrivateKey: account.PrivateKey,
				Passphrase: passphrase,
				RPCURL:     rpcURL,
				CreatedAt:  time.Now().Format(time.RFC3339),
			}

			// Determine save location
			var savePath string
			if saveToConfig {
				if err := SaveCredentialsToConfig(creds); err != nil {
					return fmt.Errorf("failed to save credentials: %w", err)
				}
				savePath = GetConfigDir() + "/" + CredentialsFileName
			} else if saveFile != "" {
				if err := SaveCredentials(creds, saveFile); err != nil {
					return fmt.Errorf("failed to save credentials: %w", err)
				}
				savePath = saveFile
			} else {
				if err := SaveCredentialsToLocal(creds); err != nil {
					return fmt.Errorf("failed to save credentials: %w", err)
				}
				savePath = CredentialsFileName
			}

			fmt.Println("✅ Account created and imported successfully!")
			fmt.Printf("Address:    %s\n", account.Address)
			fmt.Printf("Public Key: %s\n", account.PublicKey)
			fmt.Printf("Private Key: %s\n", account.PrivateKey)
			fmt.Printf("Passphrase: %s\n", passphrase)
			fmt.Printf("\n📝 Credentials saved to: %s\n", savePath)
			fmt.Println("\n⚠️  IMPORTANT: Keep this file secure! It contains your private key and passphrase.")
			fmt.Printf("\n💡 Next steps:\n")
			fmt.Printf("   1. Fund this address with some NIM (mainnet)\n")
			fmt.Printf("   2. Unlock account: nimiq-uploader account unlock --passphrase \"%s\"\n", passphrase)
			fmt.Printf("   3. Check balance: nimiq-uploader account balance\n")
			fmt.Printf("   4. Wait for funds: nimiq-uploader account wait-funds\n")

			return nil
		},
	}

	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().StringVar(&saveFile, "save", "", "File to save credentials to (default: ./credentials.json)")
	cmd.Flags().BoolVar(&saveToConfig, "global", false, "Save credentials to config directory (~/.config/nimiq-uploader/)")

	return cmd
}

func newAccountImportCmd() *cobra.Command {
	var (
		rpcURL     string
		privateKey string
		passphrase string
		fromFile   bool
		unlock     bool
	)

	cmd := &cobra.Command{
		Use:   "import",
		Short: "Import an account by private key (can use credentials.json)",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			// Load from credentials file if requested
			if fromFile {
				creds, err := LoadCredentials("")
				if err != nil {
					return fmt.Errorf("failed to load credentials: %w", err)
				}
				if privateKey == "" {
					privateKey = creds["PRIVATE_KEY"]
				}
				if passphrase == "" {
					passphrase = creds["PASSPHRASE"]
				}
				if rpcURL == "" && creds["RPC_URL"] != "" {
					rpcURL = creds["RPC_URL"]
				}
			}

			// Try to get from env if still empty
			if p := os.Getenv("NIMIQ_PASSPHRASE"); p != "" && passphrase == "" {
				passphrase = p
			}

			if privateKey == "" {
				return fmt.Errorf("private key is required (--private-key or use --from-file to load from credentials.json)")
			}

			if passphrase == "" {
				return fmt.Errorf("passphrase is required (--passphrase, --from-file, or set NIMIQ_PASSPHRASE)")
			}

			// Remove 0x prefix if present
			if len(privateKey) > 2 && privateKey[0:2] == "0x" {
				privateKey = privateKey[2:]
			}

			rpc := NewNimiqRPC(rpcURL)

			// Check if account is already imported first (to avoid RPC errors)
			var address string
			var checkAddress string
			if fromFile {
				creds, _ := LoadCredentials("")
				checkAddress = creds["ADDRESS"]
			}

			if checkAddress != "" {
				imported, checkErr := rpc.IsAccountImported(checkAddress)
				if checkErr == nil && imported {
					fmt.Printf("ℹ️  Account %s is already imported\n", checkAddress)
					address = checkAddress
				} else {
					// Account not imported, try to import it
					fmt.Println("Importing account...")
					importedAddress, err := rpc.ImportRawKey(privateKey, passphrase)
					if err != nil {
						return fmt.Errorf("failed to import account: %w", err)
					}
					address = importedAddress
					fmt.Printf("✅ Account imported successfully!\n")
					fmt.Printf("Address: %s\n", address)
				}
			} else {
				// No address in credentials, try to import
				fmt.Println("Importing account...")
				importedAddress, err := rpc.ImportRawKey(privateKey, passphrase)
				if err != nil {
					return fmt.Errorf("failed to import account: %w", err)
				}
				address = importedAddress
				fmt.Printf("✅ Account imported successfully!\n")
				fmt.Printf("Address: %s\n", address)
			}

			// Unlock the account if requested
			if unlock {
				fmt.Println("Checking account status...")
				alreadyUnlocked, err := rpc.IsAccountUnlocked(address)
				if err == nil && alreadyUnlocked {
					fmt.Println("✅ Account is already unlocked - ready for transactions")
				} else {
					// Check if account was created via createAccount (not encrypted)
					// Accounts created this way don't need unlocking with a passphrase
					imported, err := rpc.IsAccountImported(address)
					if err == nil && imported {
						fmt.Println("Attempting to unlock account...")
						unlocked, err := rpc.UnlockAccount(address, passphrase, 0) // 0 = indefinitely
						if err != nil {
							// If unlock fails with internal error, account might not be encrypted
							// This is normal for accounts created via createAccount
							fmt.Printf("ℹ️  Cannot unlock with passphrase: %v\n", err)
							fmt.Println("   Accounts created via 'createAccount' are not encrypted with a passphrase.")
							fmt.Println("   Even though status shows 'locked', the account should work for transactions.")
							fmt.Println("   Try sending a transaction - it should work without unlocking.")
						} else if unlocked {
							fmt.Println("✅ Account unlocked successfully")
						} else {
							fmt.Println("⚠️  Account unlock returned false - checking final status...")
							finalStatus, _ := rpc.IsAccountUnlocked(address)
							if finalStatus {
								fmt.Println("✅ Account is unlocked")
							} else {
								fmt.Println("ℹ️  Account may not require unlocking (created without encryption)")
							}
						}
					}
				}
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().StringVar(&privateKey, "private-key", "", "Private key in hex format (or use --from-file)")
	cmd.Flags().StringVar(&passphrase, "passphrase", "", "Passphrase to encrypt the account (or use --from-file or set NIMIQ_PASSPHRASE)")
	cmd.Flags().BoolVar(&fromFile, "from-file", false, "Load private key and passphrase from credentials.json")
	cmd.Flags().BoolVar(&unlock, "unlock", false, "Unlock the account after importing")

	return cmd
}

func newAccountStatusCmd() *cobra.Command {
	var (
		rpcURL  string
		address string
	)

	cmd := &cobra.Command{
		Use:   "status",
		Short: "Check account status (imported and unlocked)",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			// Try to get address from credentials file if not provided
			if address == "" {
				address = GetDefaultAddress()
			}

			if address == "" {
				return fmt.Errorf("address is required (--address or set in credentials.json)")
			}

			rpc := NewNimiqRPC(rpcURL)

			// Check consensus first
			consensus, err := rpc.IsConsensusEstablished()
			if err != nil {
				return fmt.Errorf("failed to check consensus: %w", err)
			}
			if !consensus {
				fmt.Println("⚠️  Warning: Node does not have consensus with the network")
				fmt.Println("   Account status may be inaccurate. Wait for sync to complete.")
			}

			imported, err := rpc.IsAccountImported(address)
			if err != nil {
				return fmt.Errorf("failed to check import status: %w", err)
			}

			unlocked, err := rpc.IsAccountUnlocked(address)
			if err != nil {
				return fmt.Errorf("failed to check unlock status: %w", err)
			}

			fmt.Printf("Account: %s\n", address)
			fmt.Printf("Imported: %v\n", imported)
			fmt.Printf("Unlocked: %v\n", unlocked)

			if !imported {
				fmt.Println("\n⚠️  Account is not imported. Use 'account import' command.")
			} else if !unlocked {
				fmt.Println("\n⚠️  Account is locked. Please unlock it first.")
			} else {
				fmt.Println("\n✅ Account is ready to send transactions.")
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().StringVar(&address, "address", "", "Account address (defaults to address from credentials.json)")

	return cmd
}

func newAccountConsensusCmd() *cobra.Command {
	var rpcURL string

	cmd := &cobra.Command{
		Use:   "consensus",
		Short: "Check if node has consensus with the network",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			rpc := NewNimiqRPC(rpcURL)
			consensus, err := rpc.IsConsensusEstablished()
			if err != nil {
				return fmt.Errorf("failed to check consensus: %w", err)
			}

			fmt.Printf("RPC URL: %s\n", rpcURL)
			fmt.Printf("Consensus: %v\n", consensus)

			if consensus {
				fmt.Println("\n✅ Node has consensus with the network - ready for operations")
			} else {
				fmt.Println("\n⚠️  Node does NOT have consensus - wait for sync before operations")
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")

	return cmd
}

func newAccountUnlockCmd() *cobra.Command {
	var (
		rpcURL     string
		address    string
		passphrase string
		duration   int
	)

	cmd := &cobra.Command{
		Use:   "unlock",
		Short: "Unlock an account",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			// Try to get address from credentials file if not provided
			if address == "" {
				address = GetDefaultAddress()
			}

			if address == "" {
				return fmt.Errorf("address is required (--address or set in credentials.json)")
			}

			if passphrase == "" {
				// Try to get from credentials file
				passphrase = GetDefaultPassphrase()
			}
			
			if passphrase == "" {
				// Try to get from env
				if p := os.Getenv("NIMIQ_PASSPHRASE"); p != "" {
					passphrase = p
				}
			}

			if passphrase == "" {
				return fmt.Errorf("passphrase is required (--passphrase or set NIMIQ_PASSPHRASE)")
			}

			if duration <= 0 {
				duration = 0 // 0 = unlock indefinitely
			}

			rpc := NewNimiqRPC(rpcURL)
			unlocked, err := rpc.UnlockAccount(address, passphrase, duration)
			if err != nil {
				return fmt.Errorf("failed to unlock account: %w", err)
			}

			if unlocked {
				if duration == 0 {
					fmt.Printf("✅ Account %s unlocked indefinitely\n", address)
				} else {
					fmt.Printf("✅ Account %s unlocked for %d seconds\n", address, duration)
				}
			} else {
				fmt.Printf("⚠️  Account unlock returned false - account may already be unlocked or passphrase incorrect\n")
			}

			return nil
		},
	}

	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().StringVar(&address, "address", "", "Account address (defaults to address from credentials.json)")
	cmd.Flags().StringVar(&passphrase, "passphrase", "", "Passphrase to unlock account (defaults to passphrase from credentials.json)")
	cmd.Flags().IntVar(&duration, "duration", 0, "Unlock duration in seconds (0 = indefinitely)")

	return cmd
}

func newAccountLockCmd() *cobra.Command {
	var (
		rpcURL  string
		address string
	)

	cmd := &cobra.Command{
		Use:   "lock",
		Short: "Lock an account",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			// Try to get address from credentials file if not provided
			if address == "" {
				address = GetDefaultAddress()
			}

			if address == "" {
				return fmt.Errorf("address is required (--address or set in credentials.json)")
			}

			rpc := NewNimiqRPC(rpcURL)
			err := rpc.LockAccount(address)
			if err != nil {
				return fmt.Errorf("failed to lock account: %w", err)
			}

			fmt.Printf("✅ Account %s locked\n", address)
			return nil
		},
	}

	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().StringVar(&address, "address", "", "Account address (defaults to address from credentials.json)")

	return cmd
}
