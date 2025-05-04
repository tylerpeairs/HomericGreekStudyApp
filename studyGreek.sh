#!/usr/bin/env bash
# start.sh — launch Anki, static server, Puppeteer proxy, and open browser

# Ensure we always return to this script's directory
cd "$(dirname "$0")"

# On exit, kill all backgrounded jobs
trap 'kill $(jobs -p)' EXIT

echo "Starting Anki..."
open -a "Anki"

echo "Starting static file server on http://localhost:8000..."
python3 -m http.server 8000 &

echo "Starting Puppeteer proxy on http://localhost:3001..."
node js/server.js &

# Give servers a moment to spin up
sleep 2

echo "Opening browser..."
open http://localhost:8000

# Wait for all background jobs to finish or be killed on exit
wait