#!/bin/bash
set -euo pipefail

DB_NAME="${MONGO_INITDB_DATABASE:-trustroots-dev}"

echo "Initializing ${DB_NAME} MongoDB database for nr-bridge..."
mongosh "${DB_NAME}" --quiet <<'EOF'
const now = new Date();

if (!db.getCollectionNames().includes("users")) {
  db.createCollection("users");
}

db.users.createIndex({ username: 1 }, { unique: true });

db.users.bulkWrite(
  [
    {
      updateOne: {
        filter: { username: "alice" },
        update: {
          $setOnInsert: {
            username: "alice",
            email: "alice@test.example.com",
            created: now,
          },
        },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { username: "bob" },
        update: {
          $setOnInsert: {
            username: "bob",
            email: "bob@test.example.com",
            created: now,
          },
        },
        upsert: true,
      },
    }
  ]
);
EOF
echo "MongoDB initialization complete."
