#!/bin/bash
# Script to check if Docker is available and enforce Docker usage

set -e

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    echo "Please install Docker to run tests: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running"
    echo "Please start Docker and try again"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ docker-compose is not available"
    echo "Please install docker-compose or use 'docker compose' (Docker Compose V2)"
    exit 1
fi

echo "✅ Docker is available"
exit 0
