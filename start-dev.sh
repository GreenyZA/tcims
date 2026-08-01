#!/bin/bash
# TCIMS Development Server Start Script
# Usage: ./start-dev.sh

cd "$(dirname "$0")"
NODE_ENV=development npm run dev