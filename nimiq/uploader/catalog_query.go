package main

import (
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
)

// normalizeAddress removes spaces and converts to uppercase for comparison
func normalizeAddress(addr string) string {
	return strings.ToUpper(strings.ReplaceAll(addr, " ", ""))
}

// getMapKeys returns all keys from a map (for debugging)
func getMapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// GetMaxAppID queries the catalog and returns the maximum app-id + 1
func GetMaxAppID(rpc *NimiqRPC, catalogAddr, publisherAddr string) (uint32, error) {
	// Normalize catalog address (remove spaces) for RPC call
	normalizedCatalogAddr := normalizeAddress(catalogAddr)

	// Query all transactions from catalog address
	transactions, err := GetAllTransactionsByAddress(rpc, normalizedCatalogAddr, 500)
	if err != nil {
		return 0, fmt.Errorf("failed to query catalog: %w", err)
	}

	maxAppID := uint32(0)
	centCount := 0

	// Parse all CENT entries to find max app-id
	normalizedPublisher := normalizeAddress(publisherAddr)
	for _, tx := range transactions {
		// Filter by publisher if specified (normalize both addresses for comparison)
		if normalizedPublisher != "" && normalizeAddress(tx.From) != normalizedPublisher {
			continue
		}

		// Parse CENT entry from transaction data
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

		centCount++
		// Parse app-id (little-endian u32 at offset 7)
		appID := binary.LittleEndian.Uint32(data[7:11])
		if appID > maxAppID {
			maxAppID = appID
		}
	}

	// Return next app-id (max + 1, or 1 if none found)
	if maxAppID == 0 {
		return 1, nil
	}
	return maxAppID + 1, nil
}

// FindAppIDByTitle queries the catalog to find app-id for a given title
// Returns the app-id if found, or 0 if not found
func FindAppIDByTitle(rpc *NimiqRPC, catalogAddr, publisherAddr, title string) (uint32, error) {
	// Normalize catalog address (remove spaces) for RPC call
	normalizedCatalogAddr := normalizeAddress(catalogAddr)

	// Query all transactions from catalog address
	transactions, err := GetAllTransactionsByAddress(rpc, normalizedCatalogAddr, 500)
	if err != nil {
		return 0, fmt.Errorf("failed to query catalog: %w", err)
	}

	// Normalize title for comparison (trim, lowercase)
	normalizedTitle := strings.ToLower(strings.TrimSpace(title))
	if normalizedTitle == "" {
		return 0, fmt.Errorf("title cannot be empty")
	}

	// Parse all CENT entries to find matching title
	normalizedPublisher := normalizeAddress(publisherAddr)
	for _, tx := range transactions {
		// Filter by publisher if specified (normalize both addresses for comparison)
		if normalizedPublisher != "" && normalizeAddress(tx.From) != normalizedPublisher {
			continue
		}

		// Parse CENT entry from transaction data
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
		appID := binary.LittleEndian.Uint32(data[7:11])

		// Extract title (16 bytes at offset 34, null-terminated)
		titleBytes := data[34:50]
		centTitle := ""
		for i := 0; i < 16; i++ {
			if titleBytes[i] == 0 {
				break
			}
			centTitle += string(titleBytes[i])
		}
		centTitle = strings.ToLower(strings.TrimSpace(centTitle))

		// Compare titles (exact match after normalization)
		if centTitle == normalizedTitle {
			return appID, nil
		}
	}

	return 0, nil // Not found
}

// GetMaxCartridgeID queries the catalog for a specific app-id and returns the maximum cartridge-id + 1
func GetMaxCartridgeID(rpc *NimiqRPC, catalogAddr, publisherAddr string, appID uint32) (uint32, error) {
	// Normalize catalog address (remove spaces) for RPC call
	normalizedCatalogAddr := normalizeAddress(catalogAddr)

	// Query all transactions from catalog address
	transactions, err := GetAllTransactionsByAddress(rpc, normalizedCatalogAddr, 500)
	if err != nil {
		return 0, fmt.Errorf("failed to query catalog: %w", err)
	}

	maxCartridgeID := uint32(0)
	cartridgeAddresses := make(map[string]bool)

	// Parse all CENT entries for this app-id to collect cartridge addresses
	normalizedPublisher := normalizeAddress(publisherAddr)
	for _, tx := range transactions {
		// Filter by publisher if specified (normalize both addresses for comparison)
		if normalizedPublisher != "" && normalizeAddress(tx.From) != normalizedPublisher {
			continue
		}

		// Parse CENT entry from transaction data
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

		// Extract cartridge address (20 bytes at offset 14)
		// Convert to NQ format for querying
		addrBytes := data[14:34]
		addrHex := ""
		for _, b := range addrBytes {
			addrHex += fmt.Sprintf("%02x", b)
		}
		cartridgeAddr := "NQ" + addrHex
		cartridgeAddresses[cartridgeAddr] = true
	}

	// Query each cartridge address to get CART headers and find max cartridge-id
	for cartridgeAddr := range cartridgeAddresses {
		// Normalize cartridge address (remove spaces) for RPC call
		normalizedCartAddr := normalizeAddress(cartridgeAddr)
		cartTxs, err := GetAllTransactionsByAddress(rpc, normalizedCartAddr, 500)
		if err != nil {
			// Skip if we can't query this address
			continue
		}

		// Find CART header in transactions
		normalizedPublisher := normalizeAddress(publisherAddr)
		for _, cartTx := range cartTxs {
			// Filter by publisher if specified (normalize both addresses for comparison)
			if normalizedPublisher != "" && normalizeAddress(cartTx.From) != normalizedPublisher {
				continue
			}

			dataHex := cartTx.Data
			if dataHex == "" {
				dataHex = cartTx.RecipientData
			}
			if dataHex == "" {
				dataHex = cartTx.SenderData
			}
			if dataHex == "" {
				continue
			}

			data, err := hex.DecodeString(dataHex)
			if err != nil || len(data) < 64 {
				continue
			}

			// Check magic
			if string(data[0:4]) != MagicCART {
				continue
			}

			// Parse cartridge-id (little-endian u32 at offset 8)
			cartridgeID := binary.LittleEndian.Uint32(data[8:12])
			if cartridgeID > maxCartridgeID {
				maxCartridgeID = cartridgeID
			}
			break // Only need one CART header per cartridge
		}
	}

	// Return next cartridge-id (max + 1, or 1 if none found)
	if maxCartridgeID == 0 {
		return 1, nil
	}
	return maxCartridgeID + 1, nil
}

// Transaction represents a transaction from getTransactionsByAddress
type Transaction struct {
	Hash          string `json:"hash"`
	From          string `json:"from"`
	To            string `json:"to"`
	Data          string `json:"data"`
	RecipientData string `json:"recipientData"`
	SenderData    string `json:"senderData"`
	Height        int64  `json:"height"`
	BlockNumber   int64  `json:"blockNumber"` // Some RPCs use blockNumber instead of height
}

// GetAllTransactionsByAddress queries all transactions for an address with paging
func GetAllTransactionsByAddress(rpc *NimiqRPC, address string, maxPerPage int) ([]Transaction, error) {
	// Normalize address (remove spaces) before RPC call
	normalizedAddr := normalizeAddress(address)

	var allTxs []Transaction
	startAt := ""

	for {
		params := map[string]interface{}{
			"address": normalizedAddr,
			"max":     maxPerPage,
		}
		if startAt != "" {
			params["startAt"] = startAt
		}

		result, err := rpc.Call("getTransactionsByAddress", params)
		if err != nil {
			return nil, fmt.Errorf("failed to call getTransactionsByAddress: %w", err)
		}

		// Parse response - RPC returns {"data": [...]} format
		var responseWrapper struct {
			Data []Transaction `json:"data"`
		}

		var txs []Transaction
		if err := json.Unmarshal(result, &responseWrapper); err == nil && len(responseWrapper.Data) > 0 {
			// Successfully parsed from "data" field
			txs = responseWrapper.Data
		} else {
			// Try direct array format
			if err := json.Unmarshal(result, &txs); err != nil {
				// Try wrapped format with "transactions" field
				var wrapped struct {
					Transactions []Transaction `json:"transactions"`
				}
				if err2 := json.Unmarshal(result, &wrapped); err2 == nil {
					txs = wrapped.Transactions
				} else {
					// Try as map to extract from various fields
					var resultMap map[string]interface{}
					if err3 := json.Unmarshal(result, &resultMap); err3 == nil {
						// Try to extract transactions from various possible fields
						if txsRaw, ok := resultMap["data"]; ok {
							if txsBytes, err := json.Marshal(txsRaw); err == nil {
								json.Unmarshal(txsBytes, &txs)
							}
						} else if txsRaw, ok := resultMap["transactions"]; ok {
							if txsBytes, err := json.Marshal(txsRaw); err == nil {
								json.Unmarshal(txsBytes, &txs)
							}
						} else if txsRaw, ok := resultMap["result"]; ok {
							if txsBytes, err := json.Marshal(txsRaw); err == nil {
								json.Unmarshal(txsBytes, &txs)
							}
						}
					}

					// If still no transactions, log the error
					if len(txs) == 0 {
						responsePreview := string(result)
						if len(responsePreview) > 1000 {
							responsePreview = responsePreview[:1000] + "..."
						}
						fmt.Printf("Failed to parse transactions. Response: %s\n", responsePreview)
						return nil, fmt.Errorf("failed to parse transactions: %w (tried multiple formats)", err)
					}
				}
			}
		}

		// Normalize transactions: use blockNumber as height if height is 0
		for i := range txs {
			if txs[i].Height == 0 && txs[i].BlockNumber > 0 {
				txs[i].Height = txs[i].BlockNumber
			}
		}

		if len(txs) == 0 {
			break
		}

		allTxs = append(allTxs, txs...)

		// Use last transaction hash as next startAt
		startAt = txs[len(txs)-1].Hash

		// If we got fewer than max, we're done
		if len(txs) < maxPerPage {
			break
		}
	}

	return allTxs, nil
}
