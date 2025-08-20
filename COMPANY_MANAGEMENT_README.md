# Company Management System

## Overview

This system has been enhanced to support multiple companies per case, where each company can have its own set of case field values. This allows for better organization and management of complex cases that involve multiple companies.

## New Features

### 1. Case Creation
- Cases are now created without company details
- After case creation, users are automatically redirected to the companies management page
- Each case can have multiple companies associated with it

### 2. Company Management
- **CaseCompanies Component**: Manages all companies for a specific case
- **CompanyWorkView Component**: Allows users to work on individual company data
- Each company has its own status and can be assigned to different employees

### 3. Database Structure

#### New Tables:
- **companies**: Stores company information
  - `id`: Primary key
  - `case_id`: Foreign key to cases table
  - `company_name`: Name of the company
  - `status`: Company status (pending, in_progress, completed, rejected)
  - `created_by`: User who created the company
  - `assigned_to`: User assigned to work on this company
  - `created_at`, `updated_at`: Timestamps

- **company_values**: Stores case field values for each company
  - `id`: Primary key
  - `company_id`: Foreign key to companies table
  - `field_key`: Reference to case field
  - `field_value`: Value for the field
  - `last_updated_by`: User who last updated this value
  - `created_at`, `updated_at`: Timestamps

### 4. API Endpoints

#### Company Management:
- `GET /api/companies/case/:caseId` - Get all companies for a case
- `POST /api/companies` - Create a new company
- `GET /api/companies/:companyId` - Get company details
- `DELETE /api/companies/:companyId` - Delete a company

#### Company Values:
- `GET /api/companies/:companyId/values` - Get all field values for a company
- `PUT /api/companies/:companyId/values` - Update company field values
- `PATCH /api/companies/:companyId/status` - Update company status

### 5. Frontend Routes

- `/case-companies/:caseId` - Manage companies for a specific case
- `/company-work/:companyId` - Work on individual company data

## Workflow

1. **Create Case**: User creates a case with basic information (client details, case title, assigned employee)
2. **Add Companies**: User is redirected to companies page where they can add multiple companies
3. **Work on Companies**: Each company can be worked on individually with its own case field values
4. **Track Progress**: Each company has its own status and can be tracked independently

## Benefits

- **Better Organization**: Multiple companies per case are clearly separated
- **Individual Tracking**: Each company can have its own status and progress
- **Flexible Assignment**: Different employees can work on different companies within the same case
- **Data Isolation**: Company-specific data is stored separately, preventing conflicts

## Setup Instructions

1. **Database Setup**: Run the database sync to create new tables
2. **Backend**: The new routes and controllers are already integrated
3. **Frontend**: New components are added to the routing system

## Usage

1. Create a new case using the existing case creation form
2. After successful creation, you'll be redirected to the companies page
3. Add companies to the case using the "Add Company" button
4. Click the "Work on Company" button to start working on individual company data
5. Use the dynamic case fields to fill in company-specific information
6. Save changes and track progress for each company independently
