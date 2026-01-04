// Package walrus provides a client for interacting with Walrus blob storage
package walrus

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"
)

// Client is a Walrus blob storage client
type Client struct {
	aggregatorURL string
	publisherURL  string
	httpClient    *http.Client
}

// StoreResponse represents the response from storing a blob
type StoreResponse struct {
	// NewlyCreated is present if the blob was newly stored
	NewlyCreated *NewlyCreatedInfo `json:"newlyCreated,omitempty"`
	// AlreadyCertified is present if the blob already existed
	AlreadyCertified *AlreadyCertifiedInfo `json:"alreadyCertified,omitempty"`
}

// NewlyCreatedInfo contains information about a newly created blob
type NewlyCreatedInfo struct {
	BlobObject BlobObjectInfo `json:"blobObject"`
	Cost       uint64         `json:"cost"`
}

// AlreadyCertifiedInfo contains information about an already certified blob
type AlreadyCertifiedInfo struct {
	BlobID   string    `json:"blobId"`
	Event    EventInfo `json:"event"`
	EndEpoch uint64    `json:"endEpoch"`
}

// BlobObjectInfo contains the blob object details
type BlobObjectInfo struct {
	ID              string      `json:"id"`
	StoredEpoch     uint64      `json:"storedEpoch"`
	BlobID          string      `json:"blobId"`
	Size            uint64      `json:"size"`
	ErasureCodeType string      `json:"erasureCodeType"`
	CertifiedEpoch  uint64      `json:"certifiedEpoch"`
	Storage         StorageInfo `json:"storage"`
}

// StorageInfo contains storage details
type StorageInfo struct {
	ID          string `json:"id"`
	StartEpoch  uint64 `json:"startEpoch"`
	EndEpoch    uint64 `json:"endEpoch"`
	StorageSize uint64 `json:"storageSize"`
}

// EventInfo contains event details
type EventInfo struct {
	TxDigest string `json:"txDigest"`
	EventSeq string `json:"eventSeq"`
}

// NewClient creates a new Walrus client
func NewClient(aggregatorURL, publisherURL string) *Client {
	return &Client{
		aggregatorURL: aggregatorURL,
		publisherURL:  publisherURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Minute, // Long timeout for large files
		},
	}
}

// Store uploads a blob to Walrus and returns the blob ID
// If publisher nodes fail, it will attempt to use the Walrus CLI as a fallback
func (c *Client) Store(data []byte, epochs int) (*StoreResponse, error) {
	// First, try HTTP publisher API
	if c.publisherURL != "" {
		result, err := c.storeViaHTTP(data, epochs)
		if err == nil {
			return result, nil
		}
		// If HTTP fails, fall through to CLI fallback
	}

	// Fallback: Try using Walrus CLI (uses your own SUI balance)
	return c.storeViaCLI(data, epochs)
}

// storeViaHTTP attempts to upload via HTTP publisher API
func (c *Client) storeViaHTTP(data []byte, epochs int) (*StoreResponse, error) {
	if c.publisherURL == "" {
		return nil, fmt.Errorf("publisher URL not configured")
	}

	// Try v1/store first, fallback to v1/blobs if needed
	url := fmt.Sprintf("%s/v1/store?epochs=%d", c.publisherURL, epochs)

	req, err := http.NewRequest("PUT", url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/octet-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to upload blob: %w", err)
	}
	defer resp.Body.Close()

	// If 404, try alternative endpoint
	if resp.StatusCode == http.StatusNotFound {
		// Try v1/blobs endpoint
		url = fmt.Sprintf("%s/v1/blobs?epochs=%d", c.publisherURL, epochs)
		req, err = http.NewRequest("PUT", url, bytes.NewReader(data))
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/octet-stream")
		
		resp, err = c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to upload blob: %w", err)
		}
		defer resp.Body.Close()
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		bodyStr := string(body)
		
		// Return error to trigger CLI fallback
		return nil, fmt.Errorf("HTTP upload failed: status %d: %s", resp.StatusCode, bodyStr)
	}

	var result StoreResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// storeViaCLI uploads using Walrus CLI (requires walrus binary to be installed)
func (c *Client) storeViaCLI(data []byte, epochs int) (*StoreResponse, error) {
	// Create a temporary file
	tmpFile, err := os.CreateTemp("", "walrus-upload-*.tmp")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	// Write data to temp file
	if _, err := tmpFile.Write(data); err != nil {
		return nil, fmt.Errorf("failed to write temp file: %w", err)
	}
	tmpFile.Close()

	// Execute walrus CLI
	// Syntax: walrus store <file> --epochs <n> --context testnet
	cmd := exec.Command("walrus", "store", tmpFile.Name(), "--epochs", fmt.Sprintf("%d", epochs), "--context", "testnet")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("walrus CLI failed (make sure 'walrus' is installed: cargo install --git https://github.com/MystenLabs/walrus.git walrus): %w\nOutput: %s", err, string(output))
	}

	// Parse output from walrus CLI
	outputStr := string(output)
	
	// Try JSON first
	var result StoreResponse
	if err := json.Unmarshal(output, &result); err == nil && result.GetBlobID() != "" {
		return &result, nil
	}
	
	// Parse text output - look for "Blob ID:" pattern
	// Walrus CLI outputs: "Blob ID: juJm532wPXdCWJWhmkaXbyC7XeXGcTQtXh5QKZP8Tn4"
	lines := strings.Split(outputStr, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Look for lines that START with "Blob ID:" (case insensitive)
		// This avoids matching log lines that contain "blob" elsewhere
		lowerLine := strings.ToLower(line)
		if strings.HasPrefix(lowerLine, "blob id:") {
			// Extract the blob ID after "Blob ID:"
			blobIDPart := strings.TrimSpace(line[8:]) // Skip "Blob ID:" (8 chars)
			// Take only the first token (blob ID is a single word)
			fields := strings.Fields(blobIDPart)
			if len(fields) > 0 {
				blobID := fields[0]
				// Remove any trailing punctuation
				blobID = strings.TrimRight(blobID, ",.;:!?")
				if len(blobID) > 10 { // Reasonable minimum length for a blob ID
					return &StoreResponse{
						NewlyCreated: &NewlyCreatedInfo{
							BlobObject: BlobObjectInfo{
								BlobID: blobID,
							},
						},
					}, nil
				}
			}
		}
	}
	
	return nil, fmt.Errorf("failed to extract blob ID from walrus CLI output\nOutput: %s", outputStr)
}

// GetBlobID extracts the blob ID from a store response
func (r *StoreResponse) GetBlobID() string {
	if r.NewlyCreated != nil {
		return r.NewlyCreated.BlobObject.BlobID
	}
	if r.AlreadyCertified != nil {
		return r.AlreadyCertified.BlobID
	}
	return ""
}

// Read downloads a blob from Walrus by its blob ID
func (c *Client) Read(blobID string) ([]byte, error) {
	if c.aggregatorURL == "" {
		return nil, fmt.Errorf("aggregator URL not configured")
	}

	url := fmt.Sprintf("%s/v1/blobs/%s", c.aggregatorURL, blobID)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to download blob: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("download failed with status %d: %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

// ReadWithRetry downloads a blob with retry logic
func (c *Client) ReadWithRetry(blobID string, maxRetries int) ([]byte, error) {
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		data, err := c.Read(blobID)
		if err == nil {
			return data, nil
		}
		lastErr = err
		time.Sleep(time.Duration(i+1) * time.Second)
	}
	return nil, fmt.Errorf("failed after %d retries: %w", maxRetries, lastErr)
}
