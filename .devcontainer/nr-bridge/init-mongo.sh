#!/bin/bash
set -e

echo "Importing trustroots-dev archive into MongoDB..."
mongorestore --archive=/archive/trustroots-dev.archive
echo "Import complete."
