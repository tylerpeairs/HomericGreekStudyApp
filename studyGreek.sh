#!/usr/bin/env bash
# studyGreek.sh — launch Anki, static file server, API proxy, Docker services, and open browser

# Ensure we always return to this script's directory
cd "$(dirname "$0")"

# On exit, stop Docker services and kill all backgrounded jobs
trap 'docker compose down; kill $(jobs -p)' EXIT

echo "Starting Anki..."
open -a "Anki"

echo "Starting static file server on http://localhost:8000..."
npm run serve &

echo "Starting API proxy on http://localhost:3001..."
npm start &

echo "Starting Docker services (Morpheus & Philologic) via Docker Compose..."
docker compose up -d

# Give servers a moment to spin up
sleep 5

echo "Opening browser to http://localhost:8000..."
open http://localhost:8000

# Wait for all background jobs to finish or be killed on exit
wait