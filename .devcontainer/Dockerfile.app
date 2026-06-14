FROM node:24.14.1

ARG DENO_VERSION=2.6.6
ARG MONGOSH_VERSION=2.3.8
ARG MAILPIT_VERSION=v1.29.6

ENV DENO_INSTALL=/usr/local
ENV JAVA_HOME=/usr/lib/jvm/default-java
ENV PATH=/root/.maestro/bin:${PATH}

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      adb \
      ca-certificates \
      curl \
      default-jre-headless \
      git \
      unzip && \
    curl -fsSL https://deno.land/install.sh | sh -s v${DENO_VERSION} && \
    curl -fsSL "https://get.maestro.mobile.dev" | bash && \
    maestro --help >/dev/null && \
    MONGOSH_ARCH="$(dpkg --print-architecture)" && \
    case "$MONGOSH_ARCH" in \
      amd64|arm64) ;; \
      *) echo "Unsupported mongosh architecture: $MONGOSH_ARCH" >&2; exit 1 ;; \
    esac && \
    curl -fsSL "https://downloads.mongodb.com/compass/mongodb-mongosh_${MONGOSH_VERSION}_${MONGOSH_ARCH}.deb" -o /tmp/mongosh.deb && \
    apt-get install -y --no-install-recommends /tmp/mongosh.deb && \
    rm /tmp/mongosh.deb && \
    MAILPIT_ARCH="$(dpkg --print-architecture)" && \
    case "$MAILPIT_ARCH" in \
      amd64|arm64) ;; \
      *) echo "Unsupported Mailpit architecture: $MAILPIT_ARCH" >&2; exit 1 ;; \
    esac && \
    curl -fsSL "https://github.com/axllent/mailpit/releases/download/${MAILPIT_VERSION}/mailpit-linux-${MAILPIT_ARCH}.tar.gz" -o /tmp/mailpit.tar.gz && \
    tar -xzf /tmp/mailpit.tar.gz -C /usr/local/bin mailpit && \
    chmod 755 /usr/local/bin/mailpit && \
    rm /tmp/mailpit.tar.gz && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable
