FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY go.mod main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o stdin-to-http main.go

FROM ghcr.io/hoytech/strfry:latest
COPY --from=builder /build/stdin-to-http /usr/local/bin/stdin-to-http

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD wget -q --spider http://127.0.0.1:7777/ || exit 1
