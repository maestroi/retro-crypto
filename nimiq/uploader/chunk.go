package main

// ==============================================================================
// LEGACY CODE - DEPRECATED
// ==============================================================================
// This file contains the old "DOOM" chunk format.
// It has been replaced by cartridge.go which uses the new CART/DATA/CENT format.
//
// The old format used:
//   - Magic: "DOOM" (4 bytes)
//   - Game ID (4 bytes)
//   - Chunk Index (4 bytes)
//   - Length (1 byte)
//   - Data (51 bytes)
//
// The new format (cartridge.go) uses:
//   - CART header with SHA256 hash and metadata
//   - DATA chunks with cartridge ID
//   - CENT catalog entries for discovery
//
// This code is kept for backwards compatibility.
// ==============================================================================

import (
	"encoding/binary"
	"fmt"
	"io"
	"os"
)

const (
	MagicDOOM   = "DOOM" // Deprecated: use MagicCART, MagicDATA, MagicCENT
	ChunkSize   = 51
	PayloadSize = 64
)

type ChunkPayload struct {
	GameID   uint32
	Index    uint32
	Length   uint8
	Data     []byte
}

// ChunkFile reads a file and returns chunk payloads
func ChunkFile(filePath string, gameID uint32) ([]ChunkPayload, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	var chunks []ChunkPayload
	idx := uint32(0)
	buffer := make([]byte, ChunkSize)

	for {
		n, err := file.Read(buffer)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read file: %w", err)
		}

		chunk := ChunkPayload{
			GameID: gameID,
			Index:  idx,
			Length: uint8(n),
			Data:   make([]byte, n),
		}
		copy(chunk.Data, buffer[:n])

		chunks = append(chunks, chunk)
		idx++

		if n < ChunkSize {
			break // Last chunk
		}
	}

	return chunks, nil
}

// EncodePayload encodes a chunk into a 64-byte payload
func EncodePayload(chunk ChunkPayload) ([]byte, error) {
	payload := make([]byte, PayloadSize)

	// Magic (4 bytes)
	copy(payload[0:4], MagicDOOM)

	// Game ID (4 bytes, little-endian)
	binary.LittleEndian.PutUint32(payload[4:8], chunk.GameID)

	// Chunk index (4 bytes, little-endian)
	binary.LittleEndian.PutUint32(payload[8:12], chunk.Index)

	// Length (1 byte)
	payload[12] = chunk.Length

	// Data (up to 51 bytes)
	if len(chunk.Data) > ChunkSize {
		return nil, fmt.Errorf("chunk data too large: %d bytes", len(chunk.Data))
	}
	copy(payload[13:13+len(chunk.Data)], chunk.Data)

	return payload, nil
}

// DecodePayload decodes a 64-byte payload into a chunk
func DecodePayload(payload []byte) (ChunkPayload, error) {
	if len(payload) < PayloadSize {
		return ChunkPayload{}, fmt.Errorf("payload too short: %d bytes", len(payload))
	}

	// Check magic
	if string(payload[0:4]) != MagicDOOM {
		return ChunkPayload{}, fmt.Errorf("invalid magic: %s", string(payload[0:4]))
	}

	gameID := binary.LittleEndian.Uint32(payload[4:8])
	idx := binary.LittleEndian.Uint32(payload[8:12])
	length := payload[12]

	if length > ChunkSize {
		return ChunkPayload{}, fmt.Errorf("invalid length: %d", length)
	}

	data := make([]byte, length)
	copy(data, payload[13:13+int(length)])

	return ChunkPayload{
		GameID: gameID,
		Index:  idx,
		Length: length,
		Data:   data,
	}, nil
}
