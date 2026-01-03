# Solana RPC Proxy

A lightweight, rate-limited Solana RPC proxy written in Go. Use this to proxy requests through your paid RPC endpoint with configurable rate limits.

## Features

- **Per-IP Rate Limiting** - Each client IP gets its own rate limit bucket
- **Global Rate Limiting** - Alternative single shared rate limit
- **Wait Mode** - Client waits for slot instead of getting rejected (smooth downloads!)
- **Retry-After Headers** - Tells clients exactly when to retry
- **CORS Support** - Full CORS support for browser-based applications
- **Metrics Endpoint** - Monitor proxy statistics at `/metrics`
- **Health Check** - Health endpoint at `/health`
- **Graceful Shutdown** - Handles SIGINT/SIGTERM for clean shutdown
- **Connection Pooling** - Efficient HTTP connection reuse
- **JSON-RPC Aware** - Proper error responses in JSON-RPC format

## Quick Start

### Build

```bash
cd rpc-proxy
go mod tidy
go build -o rpc-proxy .
```

### Run with your paid RPC endpoint

```bash
# Per-IP rate limiting (default) - each client gets 50 req/s
./rpc-proxy -upstream "https://your-paid-rpc.com"

# Higher limits for paid endpoint
./rpc-proxy -upstream "https://your-paid-rpc.com" -ip-rate 100 -ip-burst 300

# Wait mode (clients wait instead of getting 429)
./rpc-proxy -upstream "https://your-paid-rpc.com" -wait
```

### Rate Limit Modes

| Mode | Flag | Description |
|------|------|-------------|
| **per_ip** | `-mode per_ip` | Each IP gets its own rate limit (default) |
| **global** | `-mode global` | Single shared rate limit for all clients |
| **none** | `-mode none` | No rate limiting (pass-through) |

### Wait Mode vs Immediate Mode

| Mode | Flag | Behavior |
|------|------|----------|
| **Wait** | `-wait` | Client waits until rate limit allows (smooth downloads) |
| **Immediate** | `-no-wait` | Returns 429 + Retry-After immediately |

**Wait mode is recommended** - the client just waits a bit and continues, no retry logic needed!

## Configuration

### Command Line Flags

| Flag | Description | Default |
|------|-------------|---------|
| `-config` | Path to JSON config file | none |
| `-listen` | Listen address | `:8899` |
| `-upstream` | Upstream RPC URL | `https://api.testnet.solana.com` |
| `-mode` | Rate limit mode: `global`, `per_ip`, `none` | `per_ip` |
| `-rate` | Global rate limit (req/s) | `100` |
| `-burst` | Global burst size | `200` |
| `-ip-rate` | Per-IP rate limit (req/s) | `50` |
| `-ip-burst` | Per-IP burst size | `100` |
| `-wait` | Enable wait mode | `true` |
| `-no-wait` | Disable wait mode | `false` |

### Config File (JSON)

```json
{
  "listen_addr": ":8899",
  "upstream_url": "https://your-paid-rpc-endpoint.com",
  
  "rate_limit_mode": "per_ip",
  "global_rate_limit": 200,
  "global_burst_size": 500,
  "per_ip_rate_limit": 100,
  "per_ip_burst_size": 300,
  
  "wait_for_slot": true,
  "max_wait_time": "10s",
  
  "max_body_size": 10485760,
  "timeout": "30s",
  "enable_cors": true,
  "allowed_origins": ["*"],
  "log_requests": true,
  "enable_metrics": true,
  "ip_limiter_ttl": "10m"
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `RPC_UPSTREAM_URL` | Upstream RPC endpoint URL |
| `RPC_LISTEN_ADDR` | Listen address |
| `RPC_RATE_MODE` | Rate limit mode |

## Usage with Solana Retro Web

1. Start the proxy with your paid RPC:
   ```bash
   ./rpc-proxy -upstream "https://your-rpc.com" -ip-rate 100 -ip-burst 500 -wait
   ```

2. In the Solana Retro web app, use Custom RPC endpoint:
   ```
   http://localhost:8899
   ```

3. Download games without hitting rate limits! The proxy handles waiting for you.

## Recommended Settings

### For Downloading Large Games (Doom ~2.5MB, ~3000 chunks)

```bash
# With paid RPC (Helius, QuickNode, etc.)
./rpc-proxy -upstream "https://your-paid-rpc.com" \
  -mode per_ip \
  -ip-rate 100 \
  -ip-burst 500 \
  -wait
```

This allows:
- 100 requests/second per IP sustained
- Bursts up to 500 requests (for parallel batch fetching)
- Wait mode smooths out any burst spikes

### Rate Limit Recommendations by Provider

| RPC Provider | Mode | Rate | Burst |
|--------------|------|------|-------|
| Free/Public Testnet | per_ip | 10 | 30 |
| Helius (paid) | per_ip | 100-200 | 500 |
| QuickNode (paid) | per_ip | 100-200 | 500 |
| Alchemy (paid) | per_ip | 50-100 | 300 |
| Triton (paid) | per_ip | 200-500 | 1000 |

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/` | POST | JSON-RPC proxy endpoint |
| `/health` | GET | Health check |
| `/metrics` | GET | Proxy statistics (JSON) |

## Metrics

GET `/metrics` returns:

```json
{
  "uptime_seconds": 3600.5,
  "total_requests": 10000,
  "success_requests": 9950,
  "failed_requests": 20,
  "rate_limited": 30,
  "waited_requests": 500,
  "avg_wait_time_ms": 45.5,
  "bytes_in": 5242880,
  "bytes_out": 52428800,
  "rate_limit_mode": "per_ip",
  "per_ip_rate_limit": 100,
  "per_ip_burst_size": 300,
  "wait_for_slot": true,
  "active_ip_limiters": 5
}
```

## Docker

### Pull from GitHub Container Registry

```bash
docker pull ghcr.io/maestroi/solana-retro-rpc-proxy:latest
```

### Build Locally

```bash
docker build -t solana-rpc-proxy .
```

### Run Container

```bash
docker run -p 8899:8899 \
  -e RPC_UPSTREAM_URL="https://your-paid-rpc.com" \
  -e RPC_RATE_MODE="per_ip" \
  ghcr.io/maestroi/solana-retro-rpc-proxy:latest
```

## GitHub Actions CI/CD

The container is automatically built and pushed to GitHub Container Registry on:
- Push to `main` branch (tagged as `latest`)
- Tags like `rpc-proxy-v1.0.0` (tagged as `1.0.0`)
- Manual workflow dispatch

Image: `ghcr.io/maestroi/solana-retro-rpc-proxy:TAG`

Repository: https://github.com/maestroi/solana-retro

## Docker Swarm Deployment

### Production Endpoint

The Solana Retro frontend uses:
- **Production**: `https://rpc-solana-retro.maestroi.cc`
- **Development**: `http://localhost:8899`

### Deploy to Swarm

```bash
# Pull latest image
docker pull ghcr.io/YOUR_ORG/solana-retro/rpc-proxy:latest

# Deploy stack
docker stack deploy -c docker-compose.yml rpc-proxy
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_UPSTREAM_URL` | Your paid RPC endpoint | **required** |
| `RPC_RATE_MODE` | Rate limit mode | `per_ip` |
| `TAG` | Image tag | `latest` |
| `REPLICAS` | Number of replicas | `2` |

### docker-compose.yml

The included `docker-compose.yml` is configured for:
- Traefik integration with `rpc-solana-retro.maestroi.cc`
- Sticky sessions for per-IP rate limiting
- Health checks
- Resource limits
- Rolling updates

### Swarm with Cloudflare Tunnel + Traefik

1. Cloudflare Tunnel points to your Traefik ingress
2. Traefik routes `rpc-solana-retro.maestroi.cc` to the proxy service
3. Sticky sessions ensure per-IP rate limiting works correctly

### Resource Limits

Default limits in docker-compose.yml:
- CPU: 1.0 core limit, 0.1 core reserved
- Memory: 256MB limit, 32MB reserved

Adjust in `docker-compose.yml` under `deploy.resources`

## How It Works

### Per-IP Rate Limiting

Each unique client IP gets its own token bucket:
- New IPs automatically get a fresh rate limiter
- Inactive limiters are cleaned up after 10 minutes
- Supports X-Forwarded-For for proxied requests

### Wait Mode

When enabled, instead of rejecting with 429:
1. Request checks if rate limit allows
2. If not, calculates how long to wait
3. Waits (up to `max_wait_time`)
4. Proceeds with request

This makes downloads **smooth** - no retry loops, no failures, just slightly slower when hitting limits.

### Retry-After Header

When rate limited (in immediate mode), response includes:
- HTTP 429 status
- `Retry-After` header with seconds to wait
- JSON-RPC error with `retry_after_seconds` in data

## License

MIT
