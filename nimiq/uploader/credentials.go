package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

const (
	// ConfigDirName is the name of the config directory
	ConfigDirName = "nimiq-uploader"
	// CredentialsFileName is the new JSON credentials file name
	CredentialsFileName = "credentials.json"
	// LegacyCredentialsFileName is the old txt credentials file name
	LegacyCredentialsFileName = "account_credentials.txt"

	// DefaultRPCURL is the default Nimiq RPC endpoint
	// Users should run their own node or use a public endpoint
	// Set NIMIQ_RPC_URL environment variable or rpc_url in credentials file to override
	DefaultRPCURL = "http://localhost:8648"
)

// Credentials represents the JSON structure for account credentials
type Credentials struct {
	Address    string `json:"address"`
	PublicKey  string `json:"public_key,omitempty"`
	PrivateKey string `json:"private_key,omitempty"`
	Passphrase string `json:"passphrase,omitempty"`
	RPCURL     string `json:"rpc_url,omitempty"`
	CreatedAt  string `json:"created_at,omitempty"`
	Comment    string `json:"comment,omitempty"`
}

// GetConfigDir returns the config directory path
// On Linux/Mac: ~/.config/nimiq-uploader
// Falls back to current directory if home is not available
func GetConfigDir() string {
	// First check XDG_CONFIG_HOME (Linux standard)
	if xdgConfig := os.Getenv("XDG_CONFIG_HOME"); xdgConfig != "" {
		return filepath.Join(xdgConfig, ConfigDirName)
	}

	// Fall back to ~/.config
	homeDir, err := os.UserHomeDir()
	if err != nil {
		// Can't get home dir, use current directory
		return "."
	}

	return filepath.Join(homeDir, ".config", ConfigDirName)
}

// GetCredentialsPath returns the full path to the credentials file
// Searches in order:
// 1. Current directory JSON (./credentials.json)
// 2. Config directory JSON (~/.config/nimiq-uploader/credentials.json)
// 3. Legacy current directory txt (./account_credentials.txt)
// 4. Legacy config directory txt (~/.config/nimiq-uploader/account_credentials.txt)
func GetCredentialsPath() string {
	// First check current directory for JSON
	localPath := CredentialsFileName
	if _, err := os.Stat(localPath); err == nil {
		return localPath
	}

	// Check config directory for JSON
	configPath := filepath.Join(GetConfigDir(), CredentialsFileName)
	if _, err := os.Stat(configPath); err == nil {
		return configPath
	}

	// Check legacy txt in current directory
	legacyLocalPath := LegacyCredentialsFileName
	if _, err := os.Stat(legacyLocalPath); err == nil {
		return legacyLocalPath
	}

	// Check legacy txt in config directory
	legacyConfigPath := filepath.Join(GetConfigDir(), LegacyCredentialsFileName)
	if _, err := os.Stat(legacyConfigPath); err == nil {
		return legacyConfigPath
	}

	// Return JSON path as default (will error when opened)
	return localPath
}

// EnsureConfigDir creates the config directory if it doesn't exist
func EnsureConfigDir() error {
	configDir := GetConfigDir()
	return os.MkdirAll(configDir, 0700)
}

// LoadCredentials loads credentials from credentials file
// Supports both new JSON format and legacy txt format
func LoadCredentials(filename string) (map[string]string, error) {
	// If no specific filename given, use the search path
	if filename == "" || filename == CredentialsFileName || filename == LegacyCredentialsFileName {
		filename = GetCredentialsPath()
	}

	// Try to load as JSON first
	if strings.HasSuffix(filename, ".json") {
		return loadCredentialsJSON(filename)
	}

	// Fall back to legacy txt format
	return loadCredentialsTxt(filename)
}

// loadCredentialsJSON loads credentials from a JSON file
func loadCredentialsJSON(filename string) (map[string]string, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var creds Credentials
	if err := json.Unmarshal(data, &creds); err != nil {
		return nil, err
	}

	// Convert to map for backward compatibility
	result := make(map[string]string)
	result["ADDRESS"] = creds.Address
	if creds.PublicKey != "" {
		result["PUBLIC_KEY"] = creds.PublicKey
	}
	if creds.PrivateKey != "" {
		result["PRIVATE_KEY"] = creds.PrivateKey
	}
	if creds.Passphrase != "" {
		result["PASSPHRASE"] = creds.Passphrase
	}
	if creds.RPCURL != "" {
		result["RPC_URL"] = creds.RPCURL
	}

	return result, nil
}

// loadCredentialsTxt loads credentials from legacy txt format
func loadCredentialsTxt(filename string) (map[string]string, error) {
	creds := make(map[string]string)

	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// Skip comments and empty lines
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Parse KEY=VALUE format
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			creds[key] = value
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return creds, nil
}

// LoadCredentialsStruct loads credentials into a Credentials struct
func LoadCredentialsStruct(filename string) (*Credentials, error) {
	creds, err := LoadCredentials(filename)
	if err != nil {
		return nil, err
	}

	return &Credentials{
		Address:    creds["ADDRESS"],
		PublicKey:  creds["PUBLIC_KEY"],
		PrivateKey: creds["PRIVATE_KEY"],
		Passphrase: creds["PASSPHRASE"],
		RPCURL:     creds["RPC_URL"],
	}, nil
}

// GetDefaultAddress tries to load address from credentials file
// Searches in current directory first, then config directory
func GetDefaultAddress() string {
	creds, err := LoadCredentials("")
	if err != nil {
		return ""
	}
	return creds["ADDRESS"]
}

// GetDefaultPassphrase tries to load passphrase from credentials file
func GetDefaultPassphrase() string {
	creds, err := LoadCredentials("")
	if err != nil {
		return ""
	}
	return creds["PASSPHRASE"]
}

// GetDefaultRPCURL returns the RPC URL from (in order):
// 1. NIMIQ_RPC_URL environment variable
// 2. rpc_url in credentials file
// 3. DefaultRPCURL constant (localhost:8648)
func GetDefaultRPCURL() string {
	// First check environment variable
	if url := os.Getenv("NIMIQ_RPC_URL"); url != "" {
		return url
	}

	// Then check credentials file
	creds, err := LoadCredentials("")
	if err == nil && creds["RPC_URL"] != "" {
		return creds["RPC_URL"]
	}

	// Fall back to default
	return DefaultRPCURL
}

// SaveCredentials saves credentials to a JSON file
func SaveCredentials(creds *Credentials, filename string) error {
	data, err := json.MarshalIndent(creds, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filename, data, 0600)
}

// SaveCredentialsToConfig saves credentials to the config directory as JSON
func SaveCredentialsToConfig(creds *Credentials) error {
	if err := EnsureConfigDir(); err != nil {
		return err
	}

	configPath := filepath.Join(GetConfigDir(), CredentialsFileName)
	return SaveCredentials(creds, configPath)
}

// SaveCredentialsToLocal saves credentials to current directory as JSON
func SaveCredentialsToLocal(creds *Credentials) error {
	return SaveCredentials(creds, CredentialsFileName)
}

// MigrateCredentials converts legacy txt credentials to JSON format
func MigrateCredentials(txtPath string, jsonPath string) error {
	// Load from txt
	creds, err := loadCredentialsTxt(txtPath)
	if err != nil {
		return fmt.Errorf("failed to load txt credentials: %w", err)
	}

	// Create struct
	newCreds := &Credentials{
		Address:    creds["ADDRESS"],
		PublicKey:  creds["PUBLIC_KEY"],
		PrivateKey: creds["PRIVATE_KEY"],
		Passphrase: creds["PASSPHRASE"],
		RPCURL:     creds["RPC_URL"],
		CreatedAt:  time.Now().Format(time.RFC3339),
		Comment:    "Migrated from account_credentials.txt",
	}

	// Save as JSON
	return SaveCredentials(newCreds, jsonPath)
}

// newMigrateCmd creates the migrate command for converting txt to json
func newMigrateCmd() *cobra.Command {
	var inputFile string
	var outputFile string
	var global bool

	cmd := &cobra.Command{
		Use:   "migrate",
		Short: "Convert legacy txt credentials to JSON format",
		Long: `Migrate account_credentials.txt to the new credentials.json format.
		
This command reads your existing account_credentials.txt file and creates 
a new credentials.json file with the same data in a structured JSON format.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Determine input file
			if inputFile == "" {
				// Look for txt file
				if _, err := os.Stat(LegacyCredentialsFileName); err == nil {
					inputFile = LegacyCredentialsFileName
				} else {
					legacyConfigPath := filepath.Join(GetConfigDir(), LegacyCredentialsFileName)
					if _, err := os.Stat(legacyConfigPath); err == nil {
						inputFile = legacyConfigPath
					} else {
						return fmt.Errorf("no legacy credentials file found. Checked: %s, %s", 
							LegacyCredentialsFileName, legacyConfigPath)
					}
				}
			}

			// Determine output file
			if outputFile == "" {
				if global {
					if err := EnsureConfigDir(); err != nil {
						return err
					}
					outputFile = filepath.Join(GetConfigDir(), CredentialsFileName)
				} else {
					outputFile = CredentialsFileName
				}
			}

			// Check if output exists
			if _, err := os.Stat(outputFile); err == nil {
				return fmt.Errorf("output file already exists: %s (use --output to specify different path)", outputFile)
			}

			fmt.Printf("Migrating credentials...\n")
			fmt.Printf("  From: %s\n", inputFile)
			fmt.Printf("  To:   %s\n", outputFile)

			if err := MigrateCredentials(inputFile, outputFile); err != nil {
				return err
			}

			fmt.Printf("\n✓ Successfully migrated to JSON format!\n")
			fmt.Printf("\nYou can now delete the old file: %s\n", inputFile)

			return nil
		},
	}

	cmd.Flags().StringVar(&inputFile, "input", "", "Path to legacy txt credentials file")
	cmd.Flags().StringVar(&outputFile, "output", "", "Path for new JSON credentials file")
	cmd.Flags().BoolVar(&global, "global", false, "Save to global config directory (~/.config/nimiq-uploader/)")

	return cmd
}
