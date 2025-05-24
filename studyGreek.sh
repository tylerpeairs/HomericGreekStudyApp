#!/usr/bin/env bash
# start.sh — launch Anki, static server, Puppeteer proxy, and open browser

# Ensure we always return to this script's directory
cd "$(dirname "$0")"

# Load NVM and use the ARM64 Node version
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22.16.0

# Confirm Node is ARM64
echo "Shell sees node at: $(which node)"
echo "Node architecture: $(node -p 'process.arch')"

echo "Killing any existing servers on ports 8000 and 3001..."
lsof -ti tcp:8000 | xargs kill -9 2>/dev/null
lsof -ti tcp:3001 | xargs kill -9 2>/dev/null

# On exit, kill all backgrounded jobs
trap 'kill $(jobs -p)' EXIT

echo "Starting Anki..."
open -g -a "Anki" &

echo "Starting static file server on http://localhost:8000..."
python3 -m http.server 8000 &

echo "Starting Puppeteer proxy on http://localhost:3001..."
arch -arm64 node js/server.js &

# Give servers a moment to spin up
sleep 2

echo "Opening browser..."
open http://localhost:8000

sleep 1
if lsof -i :3001 > /dev/null; then
  echo "Puppeteer proxy (port 3001) is running."
else
  echo "Warning: Puppeteer proxy (port 3001) is NOT running."
fi

# Wait for all background jobs to finish or be killed on exit
wait