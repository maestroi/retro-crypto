// Package sui provides a client for interacting with Sui blockchain via JSON-RPC
package sui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is a Sui blockchain JSON-RPC client
type Client struct {
	rpcURL     string
	httpClient *http.Client
	requestID  int
}

// RPCRequest represents a JSON-RPC request
type RPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

// RPCResponse represents a JSON-RPC response
type RPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError represents a JSON-RPC error
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// ObjectResponse represents sui_getObject response
type ObjectResponse struct {
	Data *ObjectData `json:"data"`
}

// ObjectData represents object data
type ObjectData struct {
	ObjectID string                 `json:"objectId"`
	Version  string                 `json:"version"`
	Digest   string                 `json:"digest"`
	Type     string                 `json:"type"`
	Owner    interface{}            `json:"owner"`
	Content  map[string]interface{} `json:"content"`
}

// DynamicFieldsResponse represents dynamic fields response
type DynamicFieldsResponse struct {
	Data       []DynamicFieldInfo `json:"data"`
	NextCursor *string            `json:"nextCursor"`
	HasNextPage bool              `json:"hasNextPage"`
}

// DynamicFieldInfo represents a dynamic field entry
type DynamicFieldInfo struct {
	Name         DynamicFieldName `json:"name"`
	BCSName      string           `json:"bcsName"`
	Type         string           `json:"type"`
	ObjectType   string           `json:"objectType"`
	ObjectID     string           `json:"objectId"`
	Version      int              `json:"version"`
	Digest       string           `json:"digest"`
}

// DynamicFieldName represents the name of a dynamic field
type DynamicFieldName struct {
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

// NewClient creates a new Sui client
func NewClient(rpcURL string) *Client {
	return &Client{
		rpcURL: rpcURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		requestID: 1,
	}
}

// call makes a JSON-RPC call
func (c *Client) call(method string, params []interface{}) (json.RawMessage, error) {
	c.requestID++

	req := RPCRequest{
		JSONRPC: "2.0",
		ID:      c.requestID,
		Method:  method,
		Params:  params,
	}

	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.rpcURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var rpcResp RPCResponse
	if err := json.Unmarshal(body, &rpcResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("RPC error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return rpcResp.Result, nil
}

// GetObject fetches an object by ID
func (c *Client) GetObject(objectID string) (*ObjectResponse, error) {
	options := map[string]bool{
		"showContent": true,
		"showOwner":   true,
		"showType":    true,
	}

	result, err := c.call("sui_getObject", []interface{}{objectID, options})
	if err != nil {
		return nil, err
	}

	var resp ObjectResponse
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal object: %w", err)
	}

	return &resp, nil
}

// GetDynamicFields fetches dynamic fields of an object
func (c *Client) GetDynamicFields(objectID string, cursor *string, limit int) (*DynamicFieldsResponse, error) {
	params := []interface{}{objectID, cursor, limit}

	result, err := c.call("suix_getDynamicFields", params)
	if err != nil {
		return nil, err
	}

	var resp DynamicFieldsResponse
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal dynamic fields: %w", err)
	}

	return &resp, nil
}

// GetDynamicFieldObject fetches a specific dynamic field
func (c *Client) GetDynamicFieldObject(parentID string, name DynamicFieldName) (*ObjectResponse, error) {
	result, err := c.call("suix_getDynamicFieldObject", []interface{}{parentID, name})
	if err != nil {
		return nil, err
	}

	var resp ObjectResponse
	if err := json.Unmarshal(result, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal dynamic field object: %w", err)
	}

	return &resp, nil
}

// ParseCatalog extracts catalog data from object content
func ParseCatalog(data *ObjectData) map[string]interface{} {
	if data == nil || data.Content == nil {
		return nil
	}

	fields, ok := data.Content["fields"].(map[string]interface{})
	if !ok {
		return data.Content
	}
	return fields
}

// ParseCatalogEntry extracts entry data from dynamic field object
func ParseCatalogEntry(data *ObjectData) map[string]interface{} {
	if data == nil || data.Content == nil {
		return nil
	}

	fields, ok := data.Content["fields"].(map[string]interface{})
	if !ok {
		return nil
	}

	value, ok := fields["value"].(map[string]interface{})
	if !ok {
		return fields
	}

	valueFields, ok := value["fields"].(map[string]interface{})
	if !ok {
		return value
	}

	return valueFields
}

// BytesArrayToHex converts a []interface{} of numbers to hex string
func BytesArrayToHex(arr interface{}) string {
	slice, ok := arr.([]interface{})
	if !ok {
		return ""
	}
	
	result := make([]byte, len(slice))
	for i, v := range slice {
		if num, ok := v.(float64); ok {
			result[i] = byte(num)
		}
	}
	return fmt.Sprintf("%x", result)
}
