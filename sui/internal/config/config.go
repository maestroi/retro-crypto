// Package config provides configuration loading for the CLI
package config

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// Config holds all configuration values
type Config struct {
	// Sui RPC endpoint
	SuiRPCURL string `json:"sui_rpc_url"`
	// Sui network (testnet, devnet, mainnet)
	SuiNetwork string `json:"sui_network"`
	// Walrus network (testnet, devnet, mainnet)
	WalrusNetwork string `json:"walrus_network"`
	// Walrus aggregator URL for reading blobs
	WalrusAggregatorURL string `json:"walrus_aggregator_url"`
	// Walrus publisher URL for uploading blobs
	WalrusPublisherURL string `json:"walrus_publisher_url"`
	// Private key (hex encoded, without 0x prefix)
	PrivateKey string `json:"private_key"`
	// Mnemonic phrase (alternative to private key)
	Mnemonic string `json:"mnemonic"`
	// Package ID of the deployed cartridge_storage module
	PackageID string `json:"package_id"`
	// Optional: Default catalog ID for commands
	CatalogID string `json:"catalog_id"`
	// Optional: Registry object ID for catalog discovery
	RegistryID string `json:"registry_id"`
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

// Load reads configuration from config.json file or environment variables
// Priority: config.json > .env > environment variables
func Load() (*Config, error) {
	cfg := &Config{}

	// Try to load from config.json first
	if _, err := os.Stat("config.json"); err == nil {
		if err := loadJSONConfig("config.json", cfg); err != nil {
			return nil, fmt.Errorf("failed to load config from config.json: %w", err)
		}
	} else {
		// Try to load .env file if config.json doesn't exist
		loadEnvFile(".env")
	}

	// Fill in values from config file or environment variables
	if cfg.SuiNetwork == "" {
		cfg.SuiNetwork = getEnv("SUI_NETWORK", DefaultSuiNetwork)
	}
	if cfg.WalrusNetwork == "" {
		cfg.WalrusNetwork = getEnv("WALRUS_NETWORK", DefaultWalrusNetwork)
	}
	if cfg.WalrusAggregatorURL == "" {
		cfg.WalrusAggregatorURL = getEnv("WALRUS_AGGREGATOR_URL", DefaultWalrusAggregator)
	}
	if cfg.WalrusPublisherURL == "" {
		cfg.WalrusPublisherURL = getEnv("WALRUS_PUBLISHER_URL", DefaultWalrusPublisher)
	}
	if cfg.PrivateKey == "" {
		cfg.PrivateKey = getEnv("SUI_PRIVATE_KEY", "")
	}
	if cfg.Mnemonic == "" {
		cfg.Mnemonic = getEnv("SUI_MNEMONIC", "")
	}
	if cfg.PackageID == "" {
		cfg.PackageID = getEnv("PACKAGE_ID", "")
	}
	if cfg.CatalogID == "" {
		cfg.CatalogID = getEnv("CATALOG_ID", "")
	}
	if cfg.RegistryID == "" {
		cfg.RegistryID = getEnv("REGISTRY_ID", "")
	}

	// Set RPC URL based on network if not explicitly set
	if cfg.SuiRPCURL == "" {
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
	}

	return cfg, nil
}

// loadJSONConfig loads configuration from a JSON file
func loadJSONConfig(filename string, cfg *Config) error {
	data, err := os.ReadFile(filename)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, cfg)
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
