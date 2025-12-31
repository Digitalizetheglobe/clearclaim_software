# Server Deployment Scripts Guide

This guide lists all the scripts you need to run on your production server in the correct order.

## Prerequisites

1. Ensure your `.env` file is properly configured with production database credentials
2. Make sure you're in the backend directory: `cd /var/www/clearclaim_software/backend`
3. Ensure all dependencies are installed: `npm install`

## Script Execution Order

Run these scripts **in order** on your production server:

### 1. Create Base Company Tables
```bash
node migrate-company-tables.js
```
**Purpose:** Creates the base `companies` and `company_values` tables.

**Expected Output:**
```
Starting company tables migration...
✅ Database connection successful
✅ Database tables synchronized successfully
🎉 Company tables migration completed successfully!
```

---

### 2. Create Claimants Table
```bash
node migrate-add-claimants-table.js
```
**Purpose:** Creates the `claimants` table (depends on `companies` table).

**Expected Output:**
```
✅ Claimants table created successfully
```

---

### 3. Create Company Templates Table
```bash
node migrate-add-company-templates-table.js
```
**Purpose:** Creates the `company_templates` table and inserts default template definitions.

**Expected Output:**
```
🔄 Creating company_templates table...
✅ company_templates table created successfully!
🔄 Inserting default template definitions...
✅ Inserted [number] default template definitions!
```

---

### 4. Add Deal Fields to Cases Table
```bash
node migrate-add-deal-fields.js
```
**Purpose:** Adds `deal_id` and `cp_name` columns to the `cases` table.

**Expected Output:**
```
Starting migration to add deal_id and cp_name fields...
✅ Database connection successful
✅ Successfully added deal_id and cp_name columns to cases table
📋 Migration completed successfully!
```

---

### 5. Add Review Status Fields
```bash
node migrate-add-review-status-fields.js
```
**Purpose:** Adds `review_status`, `admin_remark`, `admin_comment`, and `employee_response` columns to `company_templates` table.

**Expected Output:**
```
🔄 Adding review_status and admin_remark fields to company_templates table...
✅ Review status fields added successfully!
```

---

### 6. Add Reviewer Comments Column
```bash
node migrate-add-reviewer-comments.js
```
**Purpose:** Adds `reviewer_comment` column to `company_values` table for data reviewers to add comments on specific fields.

**Expected Output:**
```
🔄 Checking if reviewer_comment column exists in company_values table...
📝 Adding reviewer_comment column to company_values table...
✅ Reviewer comment field added successfully to company_values table
Migration completed successfully
```

---

### 7. Populate Case Fields (Optional but Recommended)
```bash
node src/scripts/populateCaseFields.js
```
**Purpose:** Populates the `case_fields` table with all required field definitions.

**Expected Output:**
```
Starting to populate case fields...
Created: [field names]
Case fields population completed!
```

---

## Start the Server

After running all migrations, start your server:

```bash
# Using npm
npm start

# Or directly with node
node server.js
```

**Expected Output:**
```
Database connected successfully
Server running on port 4000
```

---

## Quick Deployment Script

You can also run all migrations in one go using this bash script:

```bash
#!/bin/bash
cd /var/www/clearclaim_software/backend

echo "🚀 Starting database migrations..."

echo "1️⃣  Creating company tables..."
node migrate-company-tables.js

echo "2️⃣  Creating claimants table..."
node migrate-add-claimants-table.js

echo "3️⃣  Creating company templates table..."
node migrate-add-company-templates-table.js

echo "4️⃣  Adding deal fields..."
node migrate-add-deal-fields.js

echo "5️⃣  Adding review status fields..."
node migrate-add-review-status-fields.js

echo "6️⃣  Adding reviewer comments column..."
node migrate-add-reviewer-comments.js

echo "7️⃣  Populating case fields..."
node src/scripts/populateCaseFields.js

echo "✅ All migrations completed!"
echo "🎉 You can now start the server with: npm start"
```

Save this as `deploy.sh`, make it executable, and run it:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## Troubleshooting

### If a migration fails:
1. Check the error message carefully
2. Verify your database connection in `.env`
3. Ensure previous migrations completed successfully
4. Some migrations use `IF NOT EXISTS` and can be safely re-run

### If you get "table already exists" errors:
- This is usually safe to ignore if the table structure is correct
- The migrations use `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### If you need to re-run a migration:
- Most migrations are idempotent (safe to run multiple times)
- They use `IF NOT EXISTS` clauses to prevent errors

---

## Verification

After running all scripts, verify your database has these tables:
- `users`
- `cases`
- `companies`
- `company_values`
- `claimants`
- `company_templates`
- `case_fields`
- `case_values`
- `activities`

You can verify by connecting to your database and running:
```sql
\dt
```

---

## Notes

- **Always backup your database** before running migrations in production
- Run migrations during a maintenance window if possible
- Test migrations on a staging environment first
- Keep your `.env` file secure and never commit it to version control

