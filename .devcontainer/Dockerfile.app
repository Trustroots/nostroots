FROM node:24.14.1

ARG DENO_VERSION=2.6.6
ARG MONGOSH_VERSION=2.3.8

ENV DENO_INSTALL=/usr/local

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      unzip && \
    curl -fsSL https://deno.land/install.sh | sh -s v${DENO_VERSION} && \
    curl -fsSL https://downloads.mongodb.com/compass/mongodb-mongosh_${MONGOSH_VERSION}_amd64.deb -o /tmp/mongosh.deb && \
    apt-get install -y --no-install-recommends /tmp/mongosh.deb && \
    rm /tmp/mongosh.deb && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable
