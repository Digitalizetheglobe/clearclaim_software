#!/bin/bash

# ClearClaim Backend Deployment Script
# This script runs all database migrations in the correct order

set -e  # Exit on any error

echo "🚀 Starting ClearClaim Backend Deployment..."
echo "=========================================="
echo ""

# Change to backend directory
cd "$(dirname "$0")"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your database configuration."
    exit 1
fi

echo "✅ Found .env file"
echo ""

# Test database connection first
echo "🔍 Testing database connection..."
node -e "require('dotenv').config(); const { sequelize } = require('./src/config/database'); sequelize.authenticate().then(() => { console.log('✅ Database connection successful'); process.exit(0); }).catch(err => { console.error('❌ Database connection failed:', err.message); process.exit(1); });"

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Database connection failed. Please check your .env file."
    exit 1
fi

echo ""
echo "📋 Running migrations in order..."
echo ""

# Migration 1: Company Tables
echo "1️⃣  Creating company tables..."
node migrate-company-tables.js
if [ $? -ne 0 ]; then
    echo "❌ Migration 1 failed!"
    exit 1
fi
echo ""

# Migration 2: Claimants Table
echo "2️⃣  Creating claimants table..."
node migrate-add-claimants-table.js
if [ $? -ne 0 ]; then
    echo "❌ Migration 2 failed!"
    exit 1
fi
echo ""

# Migration 3: Company Templates Table
echo "3️⃣  Creating company templates table..."
node migrate-add-company-templates-table.js
if [ $? -ne 0 ]; then
    echo "❌ Migration 3 failed!"
    exit 1
fi
echo ""

# Migration 4: Deal Fields
echo "4️⃣  Adding deal fields to cases table..."
node migrate-add-deal-fields.js
if [ $? -ne 0 ]; then
    echo "❌ Migration 4 failed!"
    exit 1
fi
echo ""

# Migration 5: Review Status Fields
echo "5️⃣  Adding review status fields..."
node migrate-add-review-status-fields.js
if [ $? -ne 0 ]; then
    echo "❌ Migration 5 failed!"
    exit 1
fi
echo ""

# Optional: Populate Case Fields
echo "6️⃣  Populating case fields..."
node src/scripts/populateCaseFields.js
if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Case fields population failed (this is optional)"
fi
echo ""

echo "=========================================="
echo "✅ All migrations completed successfully!"
echo ""
echo "🎉 Deployment complete! You can now start the server with:"
echo "   npm start"
echo "   or"
echo "   node server.js"
echo ""






