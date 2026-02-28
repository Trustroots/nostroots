FROM denoland/deno:2.6.6

RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://downloads.mongodb.com/compass/mongodb-mongosh_2.3.8_amd64.deb -o /tmp/mongosh.deb && \
    dpkg -i /tmp/mongosh.deb && \
    rm /tmp/mongosh.deb && \
    rm -rf /var/lib/apt/lists/*
