# Backend Setup Guide - Company Management System

## Issue Resolution

The error you encountered was due to an incorrect middleware import. I've fixed the following:

1. **Fixed middleware import**: Changed `authenticateToken` to `auth` in `backend/src/routes/companies.js`
2. **Created test scripts**: To verify all components are working
3. **Created migration script**: To safely create database tables

## Setup Steps

### 1. Test the Setup

First, run the test script to verify everything is working:

```bash
cd backend
node test-company-setup.js
```

This should output:
```
Testing company setup...
✅ Database connection successful
✅ Company models imported successfully
✅ Company routes imported successfully
✅ Company controller imported successfully
🎉 All company components are working correctly!
```

### 2. Create Database Tables

Run the migration script to create the company tables:

```bash
node migrate-company-tables.js
```

This should output:
```
Starting company tables migration...
✅ Database connection successful
✅ Database tables synchronized successfully
🎉 Company tables migration completed successfully!
📋 Created/Updated tables:
   - companies
   - company_values
```

### 3. Start the Server

Now you can start the server:

```bash
npm start
# or
node server.js
```

The server should start without errors and you should see:
```
Database connected successfully
Database models synchronized
Server running on port 4000
```

## API Endpoints Available

Once the server is running, these endpoints will be available:

### Company Management
- `GET /api/companies/case/:caseId` - Get all companies for a case
- `POST /api/companies` - Create a new company
- `GET /api/companies/:companyId` - Get company details
- `DELETE /api/companies/:companyId` - Delete a company

### Company Values
- `GET /api/companies/:companyId/values` - Get all field values for a company
- `PUT /api/companies/:companyId/values` - Update company field values
- `PATCH /api/companies/:companyId/status` - Update company status

## Troubleshooting

### If you get database connection errors:
1. Check your `.env` file has the correct database configuration
2. Ensure your database server is running
3. Verify the database exists

### If you get model import errors:
1. Make sure all model files exist in `src/models/`
2. Check that the models index file exports all models correctly

### If you get route errors:
1. Verify the middleware import is correct (`auth` not `authenticateToken`)
2. Check that all controller functions are properly exported

## Database Schema

The system will create these new tables:

### companies
- `id` (Primary Key)
- `case_id` (Foreign Key to cases)
- `company_name` (String)
- `status` (Enum: pending, in_progress, completed, rejected)
- `created_by` (Foreign Key to users)
- `assigned_to` (Foreign Key to users)
- `created_at`, `updated_at` (Timestamps)

### company_values
- `id` (Primary Key)
- `company_id` (Foreign Key to companies)
- `field_key` (String)
- `field_value` (Text)
- `last_updated_by` (Foreign Key to users)
- `created_at`, `updated_at` (Timestamps)

## Next Steps

After completing this setup:

1. **Frontend**: Make sure your frontend is pointing to the correct backend URL
2. **Test the workflow**: Create a case → Add companies → Work on company data
3. **Monitor logs**: Check server logs for any errors during operation

## Support

If you encounter any issues:

1. Check the server logs for error messages
2. Run the test script to identify which component is failing
3. Verify your database connection and configuration
4. Ensure all required environment variables are set in your `.env` file
