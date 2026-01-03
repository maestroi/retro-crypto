package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// Version information (set by ldflags during build)
var (
	Version   = "dev"
	BuildTime = "unknown"
)

func main() {
	var rootCmd = &cobra.Command{
		Use:   "nimiq-uploader",
		Short: "Nimiq blockchain game uploader CLI",
		Long: `Nimiq Uploader - Upload games and files to the Nimiq blockchain.

This tool supports uploading games using the cartridge format (CART/DATA/CENT)
and managing Nimiq accounts for transaction signing.

Credentials are loaded from (JSON format):
  1. ./credentials.json (current directory)
  2. ~/.config/nimiq-uploader/credentials.json (global config)
  
Legacy txt format is also supported:
  - ./account_credentials.txt
  - ~/.config/nimiq-uploader/account_credentials.txt

Use 'nimiq-uploader account create --global' to save credentials globally.
Use 'nimiq-uploader migrate --global' to convert old txt to new JSON format.`,
	}

	// Add version command
	rootCmd.AddCommand(&cobra.Command{
		Use:   "version",
		Short: "Print version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("nimiq-uploader %s\n", Version)
			fmt.Printf("Built: %s\n", BuildTime)
			fmt.Printf("Config dir: %s\n", GetConfigDir())
		},
	})

	// Add config command
	rootCmd.AddCommand(&cobra.Command{
		Use:   "config",
		Short: "Show configuration paths",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println("Configuration Paths:")
			fmt.Printf("  Config directory: %s\n", GetConfigDir())
			fmt.Printf("  Credentials file: %s\n", GetCredentialsPath())
			fmt.Println()

			// Check if credentials exist
			if creds, err := LoadCredentials(""); err == nil {
				fmt.Println("Loaded credentials:")
				if addr := creds["ADDRESS"]; addr != "" {
					fmt.Printf("  Address: %s\n", addr)
				}
				if rpcURL := creds["RPC_URL"]; rpcURL != "" {
					fmt.Printf("  RPC URL: %s\n", rpcURL)
				}
				fmt.Printf("  RPC URL (effective): %s\n", GetDefaultRPCURL())
			} else {
				fmt.Printf("No credentials found. Run 'nimiq-uploader account create' to create an account.\n")
			}
		},
	})

	// Main commands
	rootCmd.AddCommand(newUploadCartridgeCmd())
	rootCmd.AddCommand(newRetireAppCmd())
	rootCmd.AddCommand(newAccountCmd())
	rootCmd.AddCommand(newPackageCmd())
	rootCmd.AddCommand(newMigrateCmd()) // Migrate legacy txt to JSON

	// Legacy commands (kept for backwards compatibility)
	rootCmd.AddCommand(newUploadCmd())   // Legacy: uses old DOOM format
	rootCmd.AddCommand(newManifestCmd()) // Legacy: generates old-style manifest

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}
