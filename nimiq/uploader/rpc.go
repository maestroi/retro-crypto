package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// NimiqRPC is a client for Nimiq JSON-RPC endpoints (uploader version)
type NimiqRPC struct {
	url    string
	client *http.Client
}

func NewNimiqRPC(url string) *NimiqRPC {
	return &NimiqRPC{
		url: url,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type JSONRPCRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Call performs a JSON-RPC call with object params
func (rpc *NimiqRPC) Call(method string, params map[string]interface{}) (json.RawMessage, error) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  method,
		Params:  params,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", rpc.url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := rpc.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var jsonResp JSONRPCResponse
	if err := json.Unmarshal(respBody, &jsonResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if jsonResp.Error != nil {
		return nil, fmt.Errorf("RPC error: %s (code %d)", jsonResp.Error.Message, jsonResp.Error.Code)
	}

	return jsonResp.Result, nil
}

// IsAccountImported checks if an account has been imported
func (rpc *NimiqRPC) IsAccountImported(address string) (bool, error) {
	result, err := rpc.Call("isAccountImported", map[string]interface{}{
		"address": address,
	})
	if err != nil {
		return false, err
	}

	// Try parsing as direct bool first
	var imported bool
	if err := json.Unmarshal(result, &imported); err == nil {
		return imported, nil
	}

	// Try parsing as nested object with "data" field (Nimiq RPC format)
	var responseObj map[string]interface{}
	if err := json.Unmarshal(result, &responseObj); err == nil {
		if data, ok := responseObj["data"].(bool); ok {
			return data, nil
		}
	}

	return false, fmt.Errorf("failed to parse response: unexpected format: %s", string(result))
}

// IsAccountUnlocked checks if an account is currently unlocked
func (rpc *NimiqRPC) IsAccountUnlocked(address string) (bool, error) {
	result, err := rpc.Call("isAccountUnlocked", map[string]interface{}{
		"address": address,
	})
	if err != nil {
		return false, err
	}

	// Try parsing as direct bool first
	var unlocked bool
	if err := json.Unmarshal(result, &unlocked); err == nil {
		return unlocked, nil
	}

	// Try parsing as nested object with "data" field (Nimiq RPC format)
	var responseObj map[string]interface{}
	if err := json.Unmarshal(result, &responseObj); err == nil {
		if data, ok := responseObj["data"].(bool); ok {
			return data, nil
		}
	}

	return false, fmt.Errorf("failed to parse response: unexpected format: %s", string(result))
}

// UnlockAccount unlocks an account with a passphrase
// duration is in seconds (0 = unlock indefinitely)
func (rpc *NimiqRPC) UnlockAccount(address string, passphrase string, duration int) (bool, error) {
	result, err := rpc.Call("unlockAccount", map[string]interface{}{
		"address":    address,
		"passphrase": passphrase,
		"duration":   duration,
	})
	if err != nil {
		return false, err
	}

	// Try parsing as direct bool first
	var unlocked bool
	if err := json.Unmarshal(result, &unlocked); err == nil {
		return unlocked, nil
	}

	// Try parsing as nested object with "data" field (Nimiq RPC format)
	var responseObj map[string]interface{}
	if err := json.Unmarshal(result, &responseObj); err == nil {
		if data, ok := responseObj["data"].(bool); ok {
			return data, nil
		}
	}

	return false, fmt.Errorf("failed to parse unlock response: unexpected format: %s", string(result))
}

// LockAccount locks an account
func (rpc *NimiqRPC) LockAccount(address string) error {
	result, err := rpc.Call("lockAccount", map[string]interface{}{
		"address": address,
	})
	if err != nil {
		return err
	}

	// lockAccount returns null on success, so we just check for errors
	// If we got here without error, it succeeded
	var nullVal interface{}
	if err := json.Unmarshal(result, &nullVal); err == nil {
		return nil
	}

	// Try nested structure
	var responseObj map[string]interface{}
	if err := json.Unmarshal(result, &responseObj); err == nil {
		// If data is null, that's success
		if data, ok := responseObj["data"]; ok && data == nil {
			return nil
		}
	}

	return nil // Success if no error
}

// CreateAccount generates a new account and stores it
// Note: createAccount doesn't require passphrase, returns data in nested structure
func (rpc *NimiqRPC) CreateAccount() (*AccountInfo, error) {
	result, err := rpc.Call("createAccount", map[string]interface{}{})
	if err != nil {
		return nil, err
	}

	// Response has nested structure: {"data": {"address": "...", "publicKey": "...", "privateKey": "..."}}
	var response struct {
		Data AccountInfo `json:"data"`
	}
	if err := json.Unmarshal(result, &response); err != nil {
		// Try direct parsing as fallback
		var account AccountInfo
		if err2 := json.Unmarshal(result, &account); err2 == nil {
			return &account, nil
		}
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response.Data, nil
}

// ImportRawKey imports an account by its private key
func (rpc *NimiqRPC) ImportRawKey(keyData string, passphrase string) (string, error) {
	// Create request with array params (some RPC implementations expect positional params)
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "importRawKey",
		Params:  []interface{}{keyData, passphrase},
	}

	body, err := json.Marshal(req)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", rpc.url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := rpc.client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var jsonResp JSONRPCResponse
	if err := json.Unmarshal(respBody, &jsonResp); err != nil {
		return "", fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if jsonResp.Error != nil {
		return "", fmt.Errorf("RPC error: %s (code %d)", jsonResp.Error.Message, jsonResp.Error.Code)
	}

	// Try parsing response - may be direct string, nested object, or object with Address field
	var directAddress string
	if err := json.Unmarshal(jsonResp.Result, &directAddress); err == nil && directAddress != "" {
		return directAddress, nil
	}

	// Try parsing as object with Address field
	var response struct {
		Address string `json:"Address"`
		Data    interface{} `json:"data"`
	}
	if err := json.Unmarshal(jsonResp.Result, &response); err == nil {
		if response.Address != "" {
			return response.Address, nil
		}
		// Try to extract from data field if it's a string
		if dataStr, ok := response.Data.(string); ok && dataStr != "" {
			return dataStr, nil
		}
		// Try to extract from data field if it's an object
		if dataObj, ok := response.Data.(map[string]interface{}); ok {
			if addr, ok := dataObj["Address"].(string); ok && addr != "" {
				return addr, nil
			}
		}
	}

	return "", fmt.Errorf("no address found in response: %s", string(jsonResp.Result))
}

type AccountInfo struct {
	Address    string `json:"address"`
	PublicKey  string `json:"publicKey"`
	PrivateKey string `json:"privateKey"`
}

// IsConsensusEstablished checks if the node has established consensus with the network
func (rpc *NimiqRPC) IsConsensusEstablished() (bool, error) {
	result, err := rpc.Call("isConsensusEstablished", map[string]interface{}{})
	if err != nil {
		return false, fmt.Errorf("failed to check consensus: %w", err)
	}

	// Try parsing as direct bool first
	var established bool
	if err := json.Unmarshal(result, &established); err == nil {
		return established, nil
	}

	// Try parsing as nested object with "data" field (Nimiq RPC format)
	var consensusObj map[string]interface{}
	if err := json.Unmarshal(result, &consensusObj); err == nil {
		if data, ok := consensusObj["data"].(bool); ok {
			return data, nil
		}
		// Try as nested object
		if dataObj, ok := consensusObj["data"].(map[string]interface{}); ok {
			if boolVal, ok := dataObj["bool"].(bool); ok {
				return boolVal, nil
			}
		}
	}

	return false, fmt.Errorf("failed to parse consensus response: unexpected format: %s", string(result))
}

// GetBalance returns the account balance using getAccountByAddress
func (rpc *NimiqRPC) GetBalance(address string) (int64, error) {
	result, err := rpc.Call("getAccountByAddress", map[string]interface{}{
		"address": address,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to get account: %w", err)
	}

	// Parse response - getAccountByAddress may return nested structure with "data" field
	var responseObj map[string]interface{}
	if err := json.Unmarshal(result, &responseObj); err != nil {
		return 0, fmt.Errorf("failed to parse account response: %w", err)
	}

	// Try to get account from "data" field first (Nimiq RPC format)
	var accountObj map[string]interface{}
	if data, ok := responseObj["data"].(map[string]interface{}); ok {
		accountObj = data
	} else {
		// Try direct structure
		accountObj = responseObj
	}

	// Extract balance (can be float64 from JSON)
	balance, ok := accountObj["balance"].(float64)
	if !ok {
		// Try as int64
		if balInt, ok := accountObj["balance"].(int64); ok {
			return balInt, nil
		}
		return 0, fmt.Errorf("balance field not found or invalid type in response: %s", string(result))
	}

	return int64(balance), nil
}

// GetBlockNumber returns the current block height
func (rpc *NimiqRPC) GetBlockNumber() (int64, error) {
	result, err := rpc.Call("getBlockNumber", map[string]interface{}{})
	if err != nil {
		return 0, err
	}

	// Try parsing as direct int64 first
	var height int64
	if err := json.Unmarshal(result, &height); err == nil {
		return height, nil
	}

	// Try parsing as hex string
	var hexStr string
	if err := json.Unmarshal(result, &hexStr); err == nil {
		// Remove 0x prefix if present
		if len(hexStr) > 2 && hexStr[0:2] == "0x" {
			hexStr = hexStr[2:]
		}
		parsed, err := parseHexInt64(hexStr)
		if err == nil {
			return parsed, nil
		}
	}

	// Try parsing as nested object with "data", "number", "height", or "blockNumber" field
	var responseObj map[string]interface{}
	if err := json.Unmarshal(result, &responseObj); err == nil {
		// Check for "data" field (e.g., {"data": 38908645, "metadata": null})
		if data, ok := responseObj["data"].(float64); ok {
			return int64(data), nil
		}
		// Check for "number" field
		if num, ok := responseObj["number"].(float64); ok {
			return int64(num), nil
		}
		// Check for "height" field
		if h, ok := responseObj["height"].(float64); ok {
			return int64(h), nil
		}
		// Check for "blockNumber" field
		if bn, ok := responseObj["blockNumber"].(float64); ok {
			return int64(bn), nil
		}
	}

	return 0, fmt.Errorf("failed to parse block number: unexpected format: %s", string(result))
}

// SendBasicTransactionWithData sends a transaction with data field
func (rpc *NimiqRPC) SendBasicTransactionWithData(wallet, recipient, data string, value, fee, validityStartHeight int64) (string, error) {
	// Try with object params first
	result, err := rpc.Call("sendBasicTransactionWithData", map[string]interface{}{
		"wallet":             wallet,
		"recipient":           recipient,
		"data":                data,
		"value":               value,
		"fee":                 fee,
		"validityStartHeight": validityStartHeight,
	})
	if err != nil {
		// Try with array params (some RPC implementations expect positional parameters)
		req := JSONRPCRequest{
			JSONRPC: "2.0",
			ID:      1,
			Method:  "sendBasicTransactionWithData",
			Params:  []interface{}{wallet, recipient, data, value, fee, validityStartHeight},
		}

		body, err2 := json.Marshal(req)
		if err2 != nil {
			return "", fmt.Errorf("failed to marshal request: %w", err)
		}

		httpReq, err2 := http.NewRequest("POST", rpc.url, bytes.NewReader(body))
		if err2 != nil {
			return "", fmt.Errorf("failed to create request: %w", err)
		}
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err2 := rpc.client.Do(httpReq)
		if err2 != nil {
			return "", fmt.Errorf("failed to send request: %w", err)
		}
		defer resp.Body.Close()

		respBody, err2 := io.ReadAll(resp.Body)
		if err2 != nil {
			return "", fmt.Errorf("failed to read response: %w", err)
		}

		var jsonResp JSONRPCResponse
		if err2 := json.Unmarshal(respBody, &jsonResp); err2 != nil {
			return "", fmt.Errorf("failed to unmarshal response: %w", err2)
		}

		if jsonResp.Error != nil {
			// Include full response for debugging
			return "", fmt.Errorf("RPC error: %s (code %d). Full response: %s", jsonResp.Error.Message, jsonResp.Error.Code, string(respBody))
		}

		result = jsonResp.Result
	}

	// Try parsing response - may be direct string, nested object, or object with Blake2bHash field
	var directHash string
	if err := json.Unmarshal(result, &directHash); err == nil && directHash != "" {
		return directHash, nil
	}

	// Try parsing as object with Blake2bHash field
	var response struct {
		Blake2bHash string `json:"Blake2bHash"`
		Data        interface{} `json:"data"`
	}
	if err := json.Unmarshal(result, &response); err == nil {
		if response.Blake2bHash != "" {
			return response.Blake2bHash, nil
		}
		// Try to extract from data field if it's a string
		if dataStr, ok := response.Data.(string); ok && dataStr != "" {
			return dataStr, nil
		}
		// Try to extract from data field if it's an object
		if dataObj, ok := response.Data.(map[string]interface{}); ok {
			if hash, ok := dataObj["Blake2bHash"].(string); ok && hash != "" {
				return hash, nil
			}
		}
	}

	return "", fmt.Errorf("no transaction hash found in response: %s", string(result))
}

// parseHexInt64 parses a hex string to int64
func parseHexInt64(hexStr string) (int64, error) {
	// Remove 0x prefix if present
	if len(hexStr) > 2 && hexStr[0:2] == "0x" {
		hexStr = hexStr[2:]
	}

	var result int64
	_, err := fmt.Sscanf(hexStr, "%x", &result)
	return result, err
}
