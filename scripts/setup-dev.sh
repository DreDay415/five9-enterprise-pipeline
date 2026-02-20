#!/bin/bash

# Five9 Enterprise Pipeline - Development Setup Script

set -e

echo "================================================"
echo "Five9 Enterprise Pipeline - Development Setup"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Error: Node.js 20 or higher is required${NC}"
    echo "Current version: $(node -v)"
    exit 1
fi
echo -e "${GREEN}✓ Node.js version OK: $(node -v)${NC}"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo -e "${GREEN}✓ .env file created${NC}"
    echo -e "${YELLOW}⚠ Please edit .env with your credentials${NC}"
else
    echo -e "${YELLOW}⚠ .env file already exists${NC}"
fi
echo ""

# Create data directories
echo "Creating data directories..."
mkdir -p data/downloads
mkdir -p data/processed
mkdir -p data/failed
echo -e "${GREEN}✓ Data directories created${NC}"
echo ""

# Create test fixtures directory
echo "Creating test fixtures directory..."
mkdir -p tests/fixtures
echo -e "${GREEN}✓ Test fixtures directory created${NC}"
echo ""

# Run type check
echo "Running type check..."
if npm run typecheck; then
    echo -e "${GREEN}✓ Type check passed${NC}"
else
    echo -e "${RED}✗ Type check failed${NC}"
fi
echo ""

# Run linter
echo "Running linter..."
if npm run lint; then
    echo -e "${GREEN}✓ Linter passed${NC}"
else
    echo -e "${YELLOW}⚠ Linter found issues (run 'npm run lint:fix' to auto-fix)${NC}"
fi
echo ""

# Run tests
echo "Running tests..."
if npm test; then
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${RED}✗ Some tests failed${NC}"
fi
echo ""

# Build the project
echo "Building project..."
if npm run build; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

echo "================================================"
echo -e "${GREEN}Setup completed successfully!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Edit .env with your credentials"
echo "2. Run 'npm run dev' to start development server"
echo "3. Run 'npm test' to run tests"
echo ""
echo "Useful commands:"
echo "  npm run dev         - Start development server with hot reload"
echo "  npm test           - Run tests"
echo "  npm run test:watch - Run tests in watch mode"
echo "  npm run lint       - Run linter"
echo "  npm run build      - Build for production"
echo ""
echo "Happy coding! 🚀"
