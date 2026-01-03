# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Copy go mod files
COPY go.mod go.sum* ./
RUN go mod download

# Copy source code
COPY *.go ./

# Build binary with optimizations
ARG VERSION=dev
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -X main.Version=${VERSION}" \
    -o rpc-proxy .

# Runtime stage - using alpine for healthcheck support
FROM alpine:3.19

# Install ca-certificates for HTTPS upstream calls
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/rpc-proxy .

# Create non-root user
RUN adduser -D -H -h /app appuser
USER appuser

# Expose port
EXPOSE 8899

# Health check using built-in flag
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/rpc-proxy", "-health-check"]

# Run
ENTRYPOINT ["/app/rpc-proxy"]
