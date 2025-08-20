# Clear Claim Backend API

A comprehensive backend API for the Clear Claim legal case management system built with Node.js, Express, and PostgreSQL.

## 🚀 Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Case Management**: Complete CRUD operations for legal cases
- **User Management**: Admin panel for user management
- **Dashboard Analytics**: Real-time statistics and performance metrics
- **Activity Tracking**: Comprehensive audit trail of all system activities
- **Database**: PostgreSQL with Sequelize ORM

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd clearclaim_software/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=4000
   DB_NAME=clear_claim
   DB_USER=clearclaim_user
   DB_PASS=root
   DB_HOST=localhost
   DB_PORT=5432
   NODE_ENV=development
   JWT_SECRET=clearclaim_secret_key_2024
   ```

4. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE clear_claim;
   CREATE USER clearclaim_user WITH PASSWORD 'root';
   GRANT ALL PRIVILEGES ON DATABASE clear_claim TO clearclaim_user;
   ```

5. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Database configuration
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   ├── caseController.js    # Case management logic
│   │   └── dashboardController.js # Dashboard analytics
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── models/
│   │   ├── User.js              # User model
│   │   ├── Case.js              # Case model
│   │   ├── Activity.js          # Activity tracking model
│   │   └── index.js             # Model associations
│   └── routes/
│       ├── auth.js              # Authentication routes
│       ├── cases.js             # Case management routes
│       ├── users.js             # User management routes
│       └── dashboard.js         # Dashboard routes
├── server.js                    # Main application file
├── package.json                 # Dependencies and scripts
└── .env                         # Environment variables
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Cases
- `GET /api/cases` - Get all cases (with filters)
- `GET /api/cases/:id` - Get single case
- `POST /api/cases` - Create new case
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case
- `GET /api/cases/stats` - Get case statistics

### Users (Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get single user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard overview
- `GET /api/dashboard/status-distribution` - Get case status distribution
- `GET /api/dashboard/top-employees` - Get top performing employees
- `GET /api/dashboard/recent-activities` - Get recent activities

### Health Check
- `GET /api/health` - API health check

## 🔐 Authentication

The API uses JWT tokens for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 👥 User Roles

- **admin**: Full access to all features
- **manager**: Can create and manage cases
- **employee**: Can view and update assigned cases

## 📊 Database Models

### User
- id, name, email, password, role, avatar, is_active, last_login

### Case
- id, case_number, title, description, status, priority, client_name, client_email, client_phone, assigned_to, created_by, estimated_completion_date, actual_completion_date, documents, notes

### Activity
- id, action, description, case_id, user_id, activity_type, metadata

## 🚀 Running the Server

```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:4000`

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 4000 |
| DB_NAME | Database name | clear_claim |
| DB_USER | Database user | clearclaim_user |
| DB_PASS | Database password | root |
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 5432 |
| NODE_ENV | Environment | development |
| JWT_SECRET | JWT secret key | clearclaim_secret_key_2024 |

## 📝 License

This project is licensed under the ISC License.
