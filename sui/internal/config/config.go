// Package config provides configuration loading for the CLI
package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Config holds all configuration values
type Config struct {
	// Sui RPC endpoint
	SuiRPCURL string
	// Sui network (testnet, devnet, mainnet)
	SuiNetwork string
	// Walrus network (testnet, devnet, mainnet)
	WalrusNetwork string
	// Walrus aggregator URL for reading blobs
	WalrusAggregatorURL string
	// Walrus publisher URL for uploading blobs
	WalrusPublisherURL string
	// Private key (hex encoded, without 0x prefix)
	PrivateKey string
	// Mnemonic phrase (alternative to private key)
	Mnemonic string
	// Package ID of the deployed cartridge_storage module
	PackageID string
	// Optional: Registry object ID for catalog discovery
	RegistryID string
}

// Default configuration values
const (
	DefaultSuiNetwork       = "testnet"
	DefaultWalrusNetwork    = "testnet"
	DefaultSuiRPCTestnet    = "https://fullnode.testnet.sui.io:443"
	DefaultSuiRPCDevnet     = "https://fullnode.devnet.sui.io:443"
	DefaultSuiRPCMainnet    = "https://fullnode.mainnet.sui.io:443"
	DefaultWalrusAggregator = "https://aggregator.walrus-testnet.walrus.space"
	DefaultWalrusPublisher  = "https://publisher.walrus-testnet.walrus.space"
)

// Load reads configuration from environment and .env file
func Load() (*Config, error) {
	// Try to load .env file
	loadEnvFile(".env")

	cfg := &Config{
		SuiNetwork:          getEnv("SUI_NETWORK", DefaultSuiNetwork),
		WalrusNetwork:       getEnv("WALRUS_NETWORK", DefaultWalrusNetwork),
		WalrusAggregatorURL: getEnv("WALRUS_AGGREGATOR_URL", DefaultWalrusAggregator),
		WalrusPublisherURL:  getEnv("WALRUS_PUBLISHER_URL", DefaultWalrusPublisher),
		PrivateKey:          getEnv("SUI_PRIVATE_KEY", ""),
		Mnemonic:            getEnv("SUI_MNEMONIC", ""),
		PackageID:           getEnv("PACKAGE_ID", ""),
		RegistryID:          getEnv("REGISTRY_ID", ""),
	}

	// Set RPC URL based on network if not explicitly set
	cfg.SuiRPCURL = getEnv("SUI_RPC_URL", "")
	if cfg.SuiRPCURL == "" {
		switch strings.ToLower(cfg.SuiNetwork) {
		case "testnet":
			cfg.SuiRPCURL = DefaultSuiRPCTestnet
		case "devnet":
			cfg.SuiRPCURL = DefaultSuiRPCDevnet
		case "mainnet":
			cfg.SuiRPCURL = DefaultSuiRPCMainnet
		default:
			cfg.SuiRPCURL = DefaultSuiRPCTestnet
		}
	}

	return cfg, nil
}

// loadEnvFile loads environment variables from a .env file
func loadEnvFile(filename string) {
	file, err := os.Open(filename)
	if err != nil {
		return // File doesn't exist, that's OK
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			// Remove quotes if present
			value = strings.Trim(value, `"'`)
			if os.Getenv(key) == "" {
				os.Setenv(key, value)
			}
		}
	}
}

// getEnv returns environment variable or default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Validate checks that required configuration is present
func (c *Config) Validate() error {
	if c.SuiRPCURL == "" {
		return fmt.Errorf("SUI_RPC_URL is required")
	}
	if c.PrivateKey == "" && c.Mnemonic == "" {
		return fmt.Errorf("either SUI_PRIVATE_KEY or SUI_MNEMONIC is required")
	}
	return nil
}

// ValidateForPublish checks configuration for publish operations
func (c *Config) ValidateForPublish() error {
	if err := c.Validate(); err != nil {
		return err
	}
	if c.PackageID == "" {
		return fmt.Errorf("PACKAGE_ID is required for publish operations")
	}
	if c.WalrusPublisherURL == "" {
		return fmt.Errorf("WALRUS_PUBLISHER_URL is required for publish operations")
	}
	return nil
}
