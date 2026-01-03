FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN go build -o uploader .

FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /app

COPY --from=builder /app/uploader .

# Default entrypoint sleeps so container doesn't exit
# User runs: docker compose run uploader upload --file ... --game-id ...
ENTRYPOINT ["sleep", "infinity"]
