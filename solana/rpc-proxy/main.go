package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"golang.org/x/time/rate"
)

// Duration is a custom type that can unmarshal duration strings from JSON
type Duration struct {
	time.Duration
}

// UnmarshalJSON implements json.Unmarshaler for Duration
func (d *Duration) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return err
	}
	dur, err := time.ParseDuration(s)
	if err != nil {
		return err
	}
	d.Duration = dur
	return nil
}

// MarshalJSON implements json.Marshaler for Duration
func (d Duration) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.Duration.String())
}

// Config holds the proxy configuration
type Config struct {
	ListenAddr  string `json:"listen_addr"`
	UpstreamURL string `json:"upstream_url"`

	// Rate limiting
	RateLimitMode   string   `json:"rate_limit_mode"`   // "global", "per_ip", "none"
	GlobalRateLimit float64  `json:"global_rate_limit"` // requests per second (global)
	GlobalBurstSize int      `json:"global_burst_size"` // max burst (global)
	PerIPRateLimit  float64  `json:"per_ip_rate_limit"` // requests per second (per IP)
	PerIPBurstSize  int      `json:"per_ip_burst_size"` // max burst (per IP)
	WaitForSlot     bool     `json:"wait_for_slot"`     // if true, wait instead of reject
	MaxWaitTime     Duration `json:"max_wait_time"`     // max time to wait for a slot

	// General
	MaxBodySize    int64    `json:"max_body_size"` // max request body size in bytes
	Timeout        Duration `json:"timeout"`       // upstream request timeout
	EnableCORS     bool     `json:"enable_cors"`
	AllowedOrigins []string `json:"allowed_origins"` // empty = allow all
	LogRequests    bool     `json:"log_requests"`
	EnableMetrics  bool     `json:"enable_metrics"`

	// Cleanup
	IPLimiterTTL Duration `json:"ip_limiter_ttl"` // how long to keep inactive IP limiters

	// Method filtering
	AllowedMethods []string `json:"allowed_methods"` // empty = allow all methods
}

// Metrics tracks proxy statistics
type Metrics struct {
	mu              sync.RWMutex
	TotalRequests   int64
	SuccessRequests int64
	FailedRequests  int64
	RateLimited     int64
	WaitedRequests  int64
	TotalWaitTime   time.Duration
	BytesIn         int64
	BytesOut        int64
	StartTime       time.Time
	ActiveIPs       int
}

// ipLimiter tracks a rate limiter for a specific IP
type ipLimiter struct {
	limiter    *rate.Limiter
	lastAccess time.Time
}

// RPCProxy is the main proxy server
type RPCProxy struct {
	config        *Config
	globalLimiter *rate.Limiter
	ipLimiters    map[string]*ipLimiter
	ipMu          sync.RWMutex
	client        *http.Client
	metrics       *Metrics
}

// JSONRPCRequest represents a JSON-RPC request
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JSONRPCError represents a JSON-RPC error
type JSONRPCError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// JSONRPCResponse represents a JSON-RPC response
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

func NewRPCProxy(config *Config) *RPCProxy {
	proxy := &RPCProxy{
		config:     config,
		ipLimiters: make(map[string]*ipLimiter),
		client: &http.Client{
			Timeout: config.Timeout.Duration,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 100,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		metrics: &Metrics{
			StartTime: time.Now(),
		},
	}

	// Initialize global limiter if using global mode
	if config.RateLimitMode == "global" || config.RateLimitMode == "" {
		proxy.globalLimiter = rate.NewLimiter(rate.Limit(config.GlobalRateLimit), config.GlobalBurstSize)
	}

	// Start cleanup goroutine for per-IP limiters
	if config.RateLimitMode == "per_ip" {
		go proxy.cleanupIPLimiters()
	}

	return proxy
}

// isMethodAllowed checks if a method is in the allowed list
func (p *RPCProxy) isMethodAllowed(method string) bool {
	// If no allowed methods specified, allow all
	if len(p.config.AllowedMethods) == 0 {
		return true
	}

	// Check if method is in allowed list
	for _, allowed := range p.config.AllowedMethods {
		if allowed == method {
			return true
		}
	}

	return false
}

// getIPLimiter returns or creates a rate limiter for the given IP
func (p *RPCProxy) getIPLimiter(ip string) *rate.Limiter {
	p.ipMu.Lock()
	defer p.ipMu.Unlock()

	if limiter, exists := p.ipLimiters[ip]; exists {
		limiter.lastAccess = time.Now()
		return limiter.limiter
	}

	// Create new limiter for this IP
	limiter := rate.NewLimiter(rate.Limit(p.config.PerIPRateLimit), p.config.PerIPBurstSize)
	p.ipLimiters[ip] = &ipLimiter{
		limiter:    limiter,
		lastAccess: time.Now(),
	}

	p.metrics.mu.Lock()
	p.metrics.ActiveIPs = len(p.ipLimiters)
	p.metrics.mu.Unlock()

	return limiter
}

// cleanupIPLimiters removes stale IP limiters
func (p *RPCProxy) cleanupIPLimiters() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		p.ipMu.Lock()
		now := time.Now()
		for ip, limiter := range p.ipLimiters {
			if now.Sub(limiter.lastAccess) > p.config.IPLimiterTTL.Duration {
				delete(p.ipLimiters, ip)
			}
		}
		p.metrics.mu.Lock()
		p.metrics.ActiveIPs = len(p.ipLimiters)
		p.metrics.mu.Unlock()
		p.ipMu.Unlock()
	}
}

// getClientIP extracts the client IP from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for proxied requests)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the chain
		if idx := bytes.IndexByte([]byte(xff), ','); idx != -1 {
			return xff[:idx]
		}
		return xff
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func (p *RPCProxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Handle CORS preflight
	if r.Method == http.MethodOptions {
		p.setCORSHeaders(w, r)
		w.WriteHeader(http.StatusOK)
		return
	}

	// Set CORS headers
	if p.config.EnableCORS {
		p.setCORSHeaders(w, r)
	}

	// Handle metrics endpoint
	if r.URL.Path == "/metrics" && p.config.EnableMetrics {
		p.handleMetrics(w, r)
		return
	}

	// Handle health endpoint
	if r.URL.Path == "/health" {
		p.handleHealth(w, r)
		return
	}

	// Only allow POST for RPC
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Update metrics
	p.metrics.mu.Lock()
	p.metrics.TotalRequests++
	p.metrics.mu.Unlock()

	clientIP := getClientIP(r)

	// Get appropriate rate limiter
	var limiter *rate.Limiter
	switch p.config.RateLimitMode {
	case "per_ip":
		limiter = p.getIPLimiter(clientIP)
	case "global", "":
		limiter = p.globalLimiter
	case "none":
		limiter = nil
	}

	// Check/wait for rate limit
	if limiter != nil {
		if p.config.WaitForSlot {
			// Wait mode: wait until we can proceed (up to MaxWaitTime)
			waitStart := time.Now()
			ctx := r.Context()
			if p.config.MaxWaitTime.Duration > 0 {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, p.config.MaxWaitTime.Duration)
				defer cancel()
			}

			reservation := limiter.Reserve()
			if !reservation.OK() {
				p.writeRateLimitError(w, nil, 0)
				return
			}

			delay := reservation.Delay()
			if delay > 0 {
				p.metrics.mu.Lock()
				p.metrics.WaitedRequests++
				p.metrics.mu.Unlock()

				select {
				case <-time.After(delay):
					// Waited successfully
					waitDuration := time.Since(waitStart)
					p.metrics.mu.Lock()
					p.metrics.TotalWaitTime += waitDuration
					p.metrics.mu.Unlock()

					if p.config.LogRequests {
						log.Printf("[WAIT] IP: %s waited %v", clientIP, waitDuration)
					}
				case <-ctx.Done():
					// Timeout or cancelled
					reservation.Cancel()
					p.metrics.mu.Lock()
					p.metrics.RateLimited++
					p.metrics.mu.Unlock()

					retryAfter := int(delay.Seconds()) + 1
					p.writeRateLimitError(w, nil, retryAfter)
					return
				}
			}
		} else {
			// Immediate mode: reject if rate limited
			if !limiter.Allow() {
				p.metrics.mu.Lock()
				p.metrics.RateLimited++
				p.metrics.mu.Unlock()

				// Calculate retry-after
				reservation := limiter.Reserve()
				delay := reservation.Delay()
				reservation.Cancel()
				retryAfter := int(delay.Seconds()) + 1

				if p.config.LogRequests {
					log.Printf("[RATE] IP: %s rate limited, retry in %ds", clientIP, retryAfter)
				}

				p.writeRateLimitError(w, nil, retryAfter)
				return
			}
		}
	}

	// Read request body
	body, err := io.ReadAll(io.LimitReader(r.Body, p.config.MaxBodySize))
	if err != nil {
		p.writeRPCError(w, nil, -32700, "Failed to read request", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	p.metrics.mu.Lock()
	p.metrics.BytesIn += int64(len(body))
	p.metrics.mu.Unlock()

	// Parse request to get method for logging and validation
	var rpcReq JSONRPCRequest
	var batchReq []JSONRPCRequest
	isBatch := false

	if err := json.Unmarshal(body, &rpcReq); err != nil {
		// Try parsing as batch request
		if batchErr := json.Unmarshal(body, &batchReq); batchErr != nil {
			p.writeRPCError(w, nil, -32700, "Parse error", http.StatusBadRequest)
			return
		}
		isBatch = true
		// For batch, use first request for logging
		if len(batchReq) > 0 {
			rpcReq = batchReq[0]
		}
	}

	// Check if method is allowed
	if len(p.config.AllowedMethods) > 0 {
		if isBatch {
			// Check all methods in batch
			for _, req := range batchReq {
				if !p.isMethodAllowed(req.Method) {
					p.writeRPCError(w, req.ID, -32601, fmt.Sprintf("Method not allowed: %s", req.Method), http.StatusForbidden)
					return
				}
			}
		} else {
			// Check single request method
			if !p.isMethodAllowed(rpcReq.Method) {
				p.writeRPCError(w, rpcReq.ID, -32601, fmt.Sprintf("Method not allowed: %s", rpcReq.Method), http.StatusForbidden)
				return
			}
		}
	}

	if p.config.LogRequests {
		log.Printf("[RPC] IP: %s, Method: %s", clientIP, rpcReq.Method)
	}

	// Forward request to upstream
	resp, err := p.forwardRequest(r.Context(), body)
	if err != nil {
		p.metrics.mu.Lock()
		p.metrics.FailedRequests++
		p.metrics.mu.Unlock()

		log.Printf("[ERROR] IP: %s, Upstream error: %v", clientIP, err)
		p.writeRPCError(w, rpcReq.ID, -32603, "Upstream error: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Read response
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		p.metrics.mu.Lock()
		p.metrics.FailedRequests++
		p.metrics.mu.Unlock()

		p.writeRPCError(w, rpcReq.ID, -32603, "Failed to read upstream response", http.StatusBadGateway)
		return
	}

	p.metrics.mu.Lock()
	p.metrics.BytesOut += int64(len(respBody))
	p.metrics.SuccessRequests++
	p.metrics.mu.Unlock()

	// Copy response headers
	for k, v := range resp.Header {
		if k != "Content-Length" {
			w.Header()[k] = v
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(respBody)
}

func (p *RPCProxy) forwardRequest(ctx context.Context, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.config.UpstreamURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	return p.client.Do(req)
}

func (p *RPCProxy) setCORSHeaders(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")

	// Check if origin is allowed
	allowed := len(p.config.AllowedOrigins) == 0
	if !allowed {
		for _, o := range p.config.AllowedOrigins {
			if o == "*" || o == origin {
				allowed = true
				break
			}
		}
	}

	if allowed {
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}
	}

	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Solana-Client")
	w.Header().Set("Access-Control-Expose-Headers", "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining")
	w.Header().Set("Access-Control-Max-Age", "86400")
}

func (p *RPCProxy) writeRateLimitError(w http.ResponseWriter, id interface{}, retryAfter int) {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &JSONRPCError{
			Code:    -32005, // Server is busy
			Message: fmt.Sprintf("Rate limited. Please retry after %d seconds.", retryAfter),
			Data: map[string]interface{}{
				"retry_after_seconds": retryAfter,
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
	w.WriteHeader(http.StatusTooManyRequests)
	json.NewEncoder(w).Encode(resp)
}

func (p *RPCProxy) writeRPCError(w http.ResponseWriter, id interface{}, code int, message string, httpStatus int) {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &JSONRPCError{
			Code:    code,
			Message: message,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(httpStatus)
	json.NewEncoder(w).Encode(resp)
}

func (p *RPCProxy) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":          "ok",
		"uptime":          time.Since(p.metrics.StartTime).String(),
		"upstream":        p.config.UpstreamURL,
		"rate_limit_mode": p.config.RateLimitMode,
	})
}

func (p *RPCProxy) handleMetrics(w http.ResponseWriter, r *http.Request) {
	p.metrics.mu.RLock()
	defer p.metrics.mu.RUnlock()

	avgWaitTime := float64(0)
	if p.metrics.WaitedRequests > 0 {
		avgWaitTime = float64(p.metrics.TotalWaitTime.Milliseconds()) / float64(p.metrics.WaitedRequests)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"uptime_seconds":     time.Since(p.metrics.StartTime).Seconds(),
		"total_requests":     p.metrics.TotalRequests,
		"success_requests":   p.metrics.SuccessRequests,
		"failed_requests":    p.metrics.FailedRequests,
		"rate_limited":       p.metrics.RateLimited,
		"waited_requests":    p.metrics.WaitedRequests,
		"avg_wait_time_ms":   avgWaitTime,
		"bytes_in":           p.metrics.BytesIn,
		"bytes_out":          p.metrics.BytesOut,
		"rate_limit_mode":    p.config.RateLimitMode,
		"global_rate_limit":  p.config.GlobalRateLimit,
		"global_burst_size":  p.config.GlobalBurstSize,
		"per_ip_rate_limit":  p.config.PerIPRateLimit,
		"per_ip_burst_size":  p.config.PerIPBurstSize,
		"wait_for_slot":      p.config.WaitForSlot,
		"active_ip_limiters": p.metrics.ActiveIPs,
	})
}

func loadConfig(path string) (*Config, error) {
	// Default config
	config := &Config{
		ListenAddr:      ":8899",
		UpstreamURL:     "https://api.testnet.solana.com",
		RateLimitMode:   "per_ip", // Per-IP by default
		GlobalRateLimit: 100,      // 100 req/s global
		GlobalBurstSize: 200,      // burst 200 global
		PerIPRateLimit:  50,       // 50 req/s per IP
		PerIPBurstSize:  100,      // burst 100 per IP
		WaitForSlot:     true,     // Wait instead of reject
		MaxWaitTime:     Duration{Duration: 10 * time.Second},
		MaxBodySize:     10 * 1024 * 1024, // 10MB
		Timeout:         Duration{Duration: 30 * time.Second},
		EnableCORS:      true,
		AllowedOrigins:  []string{"*"},
		LogRequests:     true,
		EnableMetrics:   true,
		IPLimiterTTL:    Duration{Duration: 10 * time.Minute},
		AllowedMethods:  []string{}, // Empty = allow all methods
	}

	if path == "" {
		return config, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return config, nil
		}
		return nil, err
	}

	if err := json.Unmarshal(data, config); err != nil {
		return nil, err
	}

	return config, nil
}

// Version is set at build time
var Version = "dev"

func main() {
	configPath := flag.String("config", "", "Path to config file (JSON)")
	listenAddr := flag.String("listen", "", "Listen address (overrides config)")
	upstream := flag.String("upstream", "", "Upstream RPC URL (overrides config)")
	rateMode := flag.String("mode", "", "Rate limit mode: global, per_ip, none (overrides config)")
	globalRate := flag.Float64("rate", 0, "Global rate limit (requests/second)")
	globalBurst := flag.Int("burst", 0, "Global burst size")
	perIPRate := flag.Float64("ip-rate", 0, "Per-IP rate limit (requests/second)")
	perIPBurst := flag.Int("ip-burst", 0, "Per-IP burst size")
	waitMode := flag.Bool("wait", false, "Wait for slot instead of rejecting (overrides config)")
	noWait := flag.Bool("no-wait", false, "Reject immediately when rate limited")
	healthCheck := flag.Bool("health-check", false, "Run health check and exit")
	showVersion := flag.Bool("version", false, "Show version and exit")
	flag.Parse()

	// Health check mode - for Docker healthcheck
	if *healthCheck {
		port := os.Getenv("RPC_LISTEN_ADDR")
		if port == "" {
			port = ":8899"
		}
		// Extract just the port if it includes host
		if port[0] == ':' {
			port = "localhost" + port
		}

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get("http://" + port + "/health")
		if err != nil {
			fmt.Fprintf(os.Stderr, "Health check failed: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			fmt.Fprintf(os.Stderr, "Health check failed: status %d\n", resp.StatusCode)
			os.Exit(1)
		}

		fmt.Println("OK")
		os.Exit(0)
	}

	// Version
	if *showVersion {
		fmt.Printf("solana-rpc-proxy version %s\n", Version)
		os.Exit(0)
	}

	// Load config
	config, err := loadConfig(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Apply CLI overrides
	if *listenAddr != "" {
		config.ListenAddr = *listenAddr
	}
	if *upstream != "" {
		config.UpstreamURL = *upstream
	}
	if *rateMode != "" {
		config.RateLimitMode = *rateMode
	}
	if *globalRate > 0 {
		config.GlobalRateLimit = *globalRate
	}
	if *globalBurst > 0 {
		config.GlobalBurstSize = *globalBurst
	}
	if *perIPRate > 0 {
		config.PerIPRateLimit = *perIPRate
	}
	if *perIPBurst > 0 {
		config.PerIPBurstSize = *perIPBurst
	}
	if *waitMode {
		config.WaitForSlot = true
	}
	if *noWait {
		config.WaitForSlot = false
	}

	// Check for env vars
	if envUpstream := os.Getenv("RPC_UPSTREAM_URL"); envUpstream != "" {
		config.UpstreamURL = envUpstream
	}
	if envListen := os.Getenv("RPC_LISTEN_ADDR"); envListen != "" {
		config.ListenAddr = envListen
	}
	if envMode := os.Getenv("RPC_RATE_MODE"); envMode != "" {
		config.RateLimitMode = envMode
	}

	proxy := NewRPCProxy(config)

	server := &http.Server{
		Addr:         config.ListenAddr,
		Handler:      proxy,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	fmt.Println("╔════════════════════════════════════════════════════════════════╗")
	fmt.Println("║              Solana RPC Proxy - Rate Limited                   ║")
	fmt.Println("╠════════════════════════════════════════════════════════════════╣")
	fmt.Printf("║  Listen:       %-48s ║\n", config.ListenAddr)
	fmt.Printf("║  Upstream:     %-48s ║\n", truncateString(config.UpstreamURL, 48))
	fmt.Printf("║  Mode:         %-48s ║\n", config.RateLimitMode)

	switch config.RateLimitMode {
	case "global":
		fmt.Printf("║  Global Rate:  %-48s ║\n", fmt.Sprintf("%.0f req/s (burst: %d)", config.GlobalRateLimit, config.GlobalBurstSize))
	case "per_ip":
		fmt.Printf("║  Per-IP Rate:  %-48s ║\n", fmt.Sprintf("%.0f req/s (burst: %d)", config.PerIPRateLimit, config.PerIPBurstSize))
	case "none":
		fmt.Printf("║  Rate Limit:   %-48s ║\n", "DISABLED")
	}

	fmt.Printf("║  Wait Mode:    %-48s ║\n", fmt.Sprintf("%v (max: %s)", config.WaitForSlot, config.MaxWaitTime.Duration))
	fmt.Printf("║  Metrics:      %-48s ║\n", fmt.Sprintf("http://localhost%s/metrics", config.ListenAddr))
	fmt.Println("╚════════════════════════════════════════════════════════════════╝")
	fmt.Println()
	log.Printf("Starting RPC proxy on %s -> %s", config.ListenAddr, config.UpstreamURL)

	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
