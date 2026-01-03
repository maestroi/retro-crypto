// Package config provides configuration loading for the CLI
package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/viper"
)

// Config holds all configuration values
type Config struct {
	// Sui RPC endpoint
	SuiRPCURL string `mapstructure:"SUI_RPC_URL"`
	// Sui network (testnet, devnet, mainnet)
	SuiNetwork string `mapstructure:"SUI_NETWORK"`
	// Walrus network (testnet, devnet, mainnet)
	WalrusNetwork string `mapstructure:"WALRUS_NETWORK"`
	// Walrus aggregator URL for reading blobs
	WalrusAggregatorURL string `mapstructure:"WALRUS_AGGREGATOR_URL"`
	// Walrus publisher URL for uploading blobs
	WalrusPublisherURL string `mapstructure:"WALRUS_PUBLISHER_URL"`
	// Private key (hex encoded, without 0x prefix)
	PrivateKey string `mapstructure:"SUI_PRIVATE_KEY"`
	// Mnemonic phrase (alternative to private key)
	Mnemonic string `mapstructure:"SUI_MNEMONIC"`
	// Package ID of the deployed cartridge_storage module
	PackageID string `mapstructure:"PACKAGE_ID"`
	// Optional: Registry object ID for catalog discovery
	RegistryID string `mapstructure:"REGISTRY_ID"`
}

// Default configuration values
const (
	DefaultSuiNetwork          = "testnet"
	DefaultWalrusNetwork       = "testnet"
	DefaultSuiRPCTestnet       = "https://fullnode.testnet.sui.io:443"
	DefaultSuiRPCDevnet        = "https://fullnode.devnet.sui.io:443"
	DefaultSuiRPCMainnet       = "https://fullnode.mainnet.sui.io:443"
	DefaultWalrusAggregator    = "https://aggregator.walrus-testnet.walrus.space"
	DefaultWalrusPublisher     = "https://publisher.walrus-testnet.walrus.space"
)

// Load reads configuration from environment and .env file
func Load() (*Config, error) {
	v := viper.New()

	// Set defaults
	v.SetDefault("SUI_NETWORK", DefaultSuiNetwork)
	v.SetDefault("WALRUS_NETWORK", DefaultWalrusNetwork)
	v.SetDefault("WALRUS_AGGREGATOR_URL", DefaultWalrusAggregator)
	v.SetDefault("WALRUS_PUBLISHER_URL", DefaultWalrusPublisher)

	// Read from .env file if present
	v.SetConfigFile(".env")
	v.SetConfigType("env")
	if err := v.ReadInConfig(); err != nil {
		// It's okay if .env doesn't exist
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			// Only log, don't fail - environment variables may be set
		}
	}

	// Read from environment variables
	v.AutomaticEnv()

	// Create config
	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Set RPC URL based on network if not explicitly set
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

// GetEnvOrDefault returns environment variable or default value
func GetEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

