// Package model defines the data types used across the application
package model

import (
	"encoding/hex"
	"fmt"
	"time"
)

// Platform represents the game platform
type Platform uint8

const (
	PlatformDOS  Platform = 0
	PlatformGB   Platform = 1
	PlatformGBC  Platform = 2
	PlatformNES  Platform = 3
	PlatformSNES Platform = 4
)

// String returns the platform name
func (p Platform) String() string {
	switch p {
	case PlatformDOS:
		return "DOS"
	case PlatformGB:
		return "GB"
	case PlatformGBC:
		return "GBC"
	case PlatformNES:
		return "NES"
	case PlatformSNES:
		return "SNES"
	default:
		return fmt.Sprintf("Unknown(%d)", p)
	}
}

// ParsePlatform converts a string to Platform
func ParsePlatform(s string) (Platform, error) {
	switch s {
	case "dos", "DOS":
		return PlatformDOS, nil
	case "gb", "GB":
		return PlatformGB, nil
	case "gbc", "GBC":
		return PlatformGBC, nil
	case "nes", "NES":
		return PlatformNES, nil
	case "snes", "SNES":
		return PlatformSNES, nil
	default:
		return 0, fmt.Errorf("unknown platform: %s", s)
	}
}

// EmulatorCoreForPlatform returns the default emulator core for a platform
func EmulatorCoreForPlatform(p Platform) string {
	switch p {
	case PlatformDOS:
		return "jsdos"
	case PlatformGB, PlatformGBC:
		return "binjgb"
	case PlatformNES:
		return "jsnes"
	case PlatformSNES:
		return "snes9x"
	default:
		return "unknown"
	}
}

// Cartridge represents a game cartridge stored on Walrus
type Cartridge struct {
	// Object ID on Sui
	ID string `json:"id"`
	// Unique slug identifier
	Slug string `json:"slug"`
	// Human readable title
	Title string `json:"title"`
	// Platform code
	Platform Platform `json:"platform"`
	// Emulator core name
	EmulatorCore string `json:"emulator_core"`
	// Version number
	Version uint16 `json:"version"`
	// Walrus blob ID (hex encoded)
	BlobID string `json:"blob_id"`
	// SHA256 hash of the ZIP file (hex encoded)
	SHA256 string `json:"sha256"`
	// Size in bytes
	SizeBytes uint64 `json:"size_bytes"`
	// Publisher address
	Publisher string `json:"publisher"`
	// Creation timestamp
	CreatedAt time.Time `json:"created_at"`
}

// BlobIDBytes returns the blob ID as bytes
func (c *Cartridge) BlobIDBytes() ([]byte, error) {
	return hex.DecodeString(c.BlobID)
}

// SHA256Bytes returns the SHA256 hash as bytes
func (c *Cartridge) SHA256Bytes() ([]byte, error) {
	return hex.DecodeString(c.SHA256)
}

// Catalog represents a curated list of games
type Catalog struct {
	// Object ID on Sui
	ID string `json:"id"`
	// Owner address
	Owner string `json:"owner"`
	// Human readable name
	Name string `json:"name"`
	// Description
	Description string `json:"description"`
	// Number of entries
	Count uint64 `json:"count"`
}

// CatalogEntry represents an entry in a catalog
type CatalogEntry struct {
	// Slug (key)
	Slug string `json:"slug"`
	// Cartridge object ID
	CartridgeID string `json:"cartridge_id"`
	// Game title
	Title string `json:"title"`
	// Platform code
	Platform Platform `json:"platform"`
	// Size in bytes
	SizeBytes uint64 `json:"size_bytes"`
	// Emulator core
	EmulatorCore string `json:"emulator_core"`
	// Version
	Version uint16 `json:"version"`
	// Optional cover image blob ID
	CoverBlobID string `json:"cover_blob_id,omitempty"`
}

// RegistryEntry represents a catalog in the registry
type RegistryEntry struct {
	// Catalog object ID
	CatalogID string `json:"catalog_id"`
	// Catalog name
	Name string `json:"name"`
	// Description
	Description string `json:"description"`
	// Primary platform focus (255 = mixed)
	PrimaryPlatform Platform `json:"primary_platform"`
}

// PublishResult contains the result of a publish operation
type PublishResult struct {
	// Catalog ID
	CatalogID string `json:"catalog_id"`
	// Cartridge object ID
	CartridgeID string `json:"cartridge_id"`
	// Walrus blob ID
	BlobID string `json:"blob_id"`
	// SHA256 of the uploaded file
	SHA256 string `json:"sha256"`
	// Size in bytes
	SizeBytes uint64 `json:"size_bytes"`
	// Transaction digest
	TxDigest string `json:"tx_digest"`
	// Slug
	Slug string `json:"slug"`
	// Title
	Title string `json:"title"`
}

