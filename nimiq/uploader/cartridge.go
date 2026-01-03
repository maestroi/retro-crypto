package main

import (
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"os"
	"strings"
)

const (
	MagicCART = "CART"
	MagicDATA = "DATA"
	MagicCENT = "CENT"

	// CENT flags
	FlagRetired = 0x01 // Bit 0: App is retired and should not be shown in listings
)

// CARTHeader represents a cartridge header payload (64 bytes)
type CARTHeader struct {
	Schema      uint8
	Platform    uint8
	ChunkSize   uint8
	Flags       uint8
	CartridgeID uint32
	TotalSize   uint64
	SHA256      [32]byte
}

// EncodeCART encodes a CART header into a 64-byte payload
func EncodeCART(header CARTHeader) ([]byte, error) {
	payload := make([]byte, 64)

	// MAGIC "CART" (4 bytes)
	copy(payload[0:4], MagicCART)

	// schema (1 byte)
	payload[4] = header.Schema

	// platform (1 byte)
	payload[5] = header.Platform

	// chunk_size (1 byte)
	payload[6] = header.ChunkSize

	// flags (1 byte)
	payload[7] = header.Flags

	// cartridge_id (u32, little-endian)
	binary.LittleEndian.PutUint32(payload[8:12], header.CartridgeID)

	// total_size (u64, little-endian)
	binary.LittleEndian.PutUint64(payload[12:20], header.TotalSize)

	// sha256 (32 bytes)
	copy(payload[20:52], header.SHA256[:])

	// reserved (12 bytes) - already zero

	return payload, nil
}

// DATAPayload represents a DATA chunk payload (64 bytes)
type DATAPayload struct {
	CartridgeID uint32
	ChunkIndex  uint32
	Length      uint8
	Data        []byte
}

// EncodeDATA encodes a DATA chunk into a 64-byte payload
func EncodeDATA(payload DATAPayload) ([]byte, error) {
	buf := make([]byte, 64)

	// MAGIC "DATA" (4 bytes)
	copy(buf[0:4], MagicDATA)

	// cartridge_id (u32, little-endian)
	binary.LittleEndian.PutUint32(buf[4:8], payload.CartridgeID)

	// chunk_index (u32, little-endian)
	binary.LittleEndian.PutUint32(buf[8:12], payload.ChunkIndex)

	// len (1 byte)
	if payload.Length > 51 {
		return nil, fmt.Errorf("chunk data too large: %d bytes (max 51)", payload.Length)
	}
	buf[12] = payload.Length

	// bytes (51 bytes)
	if len(payload.Data) > 51 {
		return nil, fmt.Errorf("chunk data too large: %d bytes (max 51)", len(payload.Data))
	}
	copy(buf[13:13+len(payload.Data)], payload.Data)

	return buf, nil
}

// CENTEntry represents a CENT catalog entry payload (64 bytes)
type CENTEntry struct {
	Schema        uint8
	Platform      uint8
	Flags         uint8
	AppID         uint32
	Semver        [3]uint8 // major, minor, patch
	CartridgeAddr [20]byte // 20-byte address
	TitleShort    string   // max 16 bytes (null-terminated)
}

// EncodeCENT encodes a CENT entry into a 64-byte payload
func EncodeCENT(entry CENTEntry) ([]byte, error) {
	payload := make([]byte, 64)

	// MAGIC "CENT" (4 bytes)
	copy(payload[0:4], MagicCENT)

	// schema (1 byte)
	payload[4] = entry.Schema

	// platform (1 byte)
	payload[5] = entry.Platform

	// flags (1 byte)
	payload[6] = entry.Flags

	// app_id (u32, little-endian)
	binary.LittleEndian.PutUint32(payload[7:11], entry.AppID)

	// semver (3 bytes: major, minor, patch)
	payload[11] = entry.Semver[0]
	payload[12] = entry.Semver[1]
	payload[13] = entry.Semver[2]

	// cartridge_address (20 bytes)
	copy(payload[14:34], entry.CartridgeAddr[:])

	// title_short (16 bytes, null-terminated)
	titleBytes := []byte(entry.TitleShort)
	if len(titleBytes) > 15 {
		titleBytes = titleBytes[:15]
	}
	copy(payload[34:34+len(titleBytes)], titleBytes)
	// null terminator is already zero (rest of buffer is zero)

	// reserved (14 bytes) - already zero

	return payload, nil
}

// Nimiq base32 alphabet (excludes I, O, U, V, W, Z to avoid confusion)
const nimiqBase32Alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVXY"

// AddressNQToBytes converts a Nimiq address string (NQ...) to 20-byte binary
// Nimiq address format is IBAN-style:
// - NQ (2 chars) + check digits (2 chars) + address body (32 base32 chars)
// - The check digits are MOD-97-10 calculated over the address body
// - We skip the check digits and decode only the 32-char address body
func AddressNQToBytes(address string) ([20]byte, error) {
	var result [20]byte

	// Remove spaces (Nimiq addresses are often formatted with spaces)
	address = strings.ReplaceAll(address, " ", "")

	if len(address) != 36 || address[:2] != "NQ" {
		return result, fmt.Errorf("invalid address format: expected NQ + 34 chars, got %d chars", len(address))
	}

	// Skip NQ (2 chars) and check digits (2 chars), decode only the 32-char address body
	base32Str := strings.ToUpper(address[4:]) // Skip "NQ" + check digits
	if len(base32Str) != 32 {
		return result, fmt.Errorf("invalid address body length: expected 32 base32 chars, got %d", len(base32Str))
	}

	// Build a lookup map for the base32 alphabet
	alphabetMap := make(map[byte]int)
	for i, c := range nimiqBase32Alphabet {
		alphabetMap[byte(c)] = i
	}

	// Decode 32 base32 characters = 160 bits = exactly 20 bytes
	decoded := make([]byte, 0, 20)
	bitBuffer := uint64(0)
	bitsInBuffer := 0

	for i := 0; i < 32; i++ {
		char := base32Str[i]
		value, ok := alphabetMap[char]
		if !ok {
			return result, fmt.Errorf("invalid base32 character: %c (not in Nimiq alphabet)", char)
		}

		bitBuffer = (bitBuffer << 5) | uint64(value)
		bitsInBuffer += 5

		for bitsInBuffer >= 8 {
			decoded = append(decoded, byte(bitBuffer>>(bitsInBuffer-8)))
			bitsInBuffer -= 8
			bitBuffer &= (1 << bitsInBuffer) - 1
		}
	}

	if len(decoded) != 20 {
		return result, fmt.Errorf("decoded address wrong size: got %d bytes, expected 20", len(decoded))
	}

	copy(result[:], decoded)
	return result, nil
}

// CalculateFileSHA256 calculates SHA256 hash of a file
func CalculateFileSHA256(filePath string) ([32]byte, error) {
	var hash [32]byte
	data, err := os.ReadFile(filePath)
	if err != nil {
		return hash, err
	}
	h := sha256.Sum256(data)
	copy(hash[:], h[:])
	return hash, nil
}
