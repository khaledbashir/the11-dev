#!/bin/bash

# 🚀 Social Garden SOW Generator - Development Server
# Runs frontend + backend with one command!

set -e

echo "🔥 Starting Social Garden SOW Generator in DEV mode..."
echo ""

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: Must run from /root/the11/ directory!"
    exit 1
fi

# Kill any Docker containers
echo "🛑 Stopping Docker containers (if running)..."
docker-compose down 2>/dev/null || true

# Kill any processes on our ports
echo "🧹 Cleaning up ports..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
sleep 1

# Start PDF service in background
echo "📄 Starting PDF service on port 8000..."
cd pdf-service
if [ ! -d "venv" ]; then
    echo "  Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/pdf-service.log 2>&1 &
PDF_PID=$!
echo "  ✅ PDF service started (PID: $PDF_PID)"
cd ..

# Start frontend
echo "🎨 Starting frontend on port 3333..."
cd novel-editor-demo/apps/web

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies (first time only)..."
    pnpm install
fi

echo ""
echo "======================================"
echo "🎉 READY TO CODE!"
echo "======================================"
echo ""
echo "Frontend: http://localhost:3333"
echo "PDF API:  http://localhost:8000"
echo ""
echo "📝 Edit files and see changes INSTANTLY!"
echo "📊 Logs:"
echo "  - Frontend: Right here in this terminal"
echo "  - PDF API: tail -f /tmp/pdf-service.log"
echo ""
echo "Press Ctrl+C to stop everything"
echo ""

# Run frontend (this keeps terminal open)
PORT=3333 pnpm dev

# Cleanup on exit
trap "echo ''; echo '🛑 Stopping services...'; kill $PDF_PID 2>/dev/null; echo '✅ Stopped!'" EXIT
