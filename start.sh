#!/bin/sh
set -e

# Første opstart på et tomt volume: opret skema og læg demodata ind.
# initializeDatabase() kører også (idempotent, med migreringer) i selve
# serveren, så en eksisterende database røres ikke her.
if [ ! -f "$DB_PATH" ]; then
    echo "Ingen database på $DB_PATH — opretter skema og demodata..."
    node backend/seed-demo.js
    echo "Demodata oprettet."
fi

exec node backend/src/index.js
