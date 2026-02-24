FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY go.mod main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -o nr-relay main.go

FROM ghcr.io/trustroots/strfry:master
COPY --from=builder /build/nr-relay /usr/local/bin/nr-relay
