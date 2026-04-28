FROM golang:1.25-bookworm AS builder
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -o /out/nip42relay ./cmd/nip42relay

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 --home-dir /nonexistent nip42relay \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /out/nip42relay /usr/local/bin/nip42relay
RUN mkdir -p /data \
    && chown -R nip42relay:nip42relay /data /app
USER nip42relay
EXPOSE 8042
CMD ["nip42relay"]
