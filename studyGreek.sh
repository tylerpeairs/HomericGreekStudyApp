#!/usr/bin/env bash
# studyGreek.sh — launch Anki, static file server, API proxy, Docker services, and open browser


# Ensure we always return to this script's directory
cd "$(dirname "$0")"

# 🚨 Ensure Docker is running
echo "Checking if Docker is running..."
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Attempting to start Docker Desktop..."
  open -a Docker
  # Wait until Docker daemon is ready
  while ! docker info >/dev/null 2>&1; do
    echo "Waiting for Docker to launch..."
    sleep 2
  done
fi
echo "Docker is running."

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