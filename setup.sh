#!/bin/bash

echo "🚀 Setting up Social Garden SOW Generator..."
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install git first."
    exit 1
fi

# Initialize and update submodules
echo "📦 Initializing git submodules..."
git submodule update --init --recursive

if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize submodules"
    exit 1
fi

echo "✅ Submodules initialized successfully!"
echo ""

# Check if Docker is available
if command -v docker &> /dev/null && command -v docker-compose &> /dev/null; then
    echo "🐳 Docker detected. You can now run:"
    echo "   docker-compose up --build"
    echo ""
else
    echo "⚠️  Docker not detected. You can run manually:"
    echo "   cd novel-editor-demo/apps/web && npm install && npm run dev"
    echo ""
fi

echo "✅ Setup complete! Your repository is ready to run."
