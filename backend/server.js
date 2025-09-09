const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize } = require('./src/config/database');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

require('./src/models');

const userRoutes = require('./src/routes/users');
const caseRoutes = require('./src/routes/cases');
const caseFieldRoutes = require('./src/routes/caseFields');
const companyRoutes = require('./src/routes/companies');
const claimantRoutes = require('./src/routes/claimants');
const companyTemplateRoutes = require('./src/routes/companyTemplates');
const caseTemplateRoutes = require('./src/routes/caseTemplates');

app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/case-fields', caseFieldRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/claimants', claimantRoutes);
app.use('/api/company-templates', companyTemplateRoutes);
app.use('/api/case-templates', caseTemplateRoutes);




// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle Sequelize errors gracefully
  if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeDatabaseError') {
    return res.status(503).json({ 
      error: 'Database temporarily unavailable',
      message: 'Please try again later or contact support if the issue persists'
    });
  }
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4000;

// Database connection and server start
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');
    
    if (process.env.NODE_ENV === 'development') {
      try {
        await sequelize.sync({ alter: true });
        console.log('Database models synchronized');
      } catch (syncError) {
        console.error('Database sync failed:', syncError.message);
      }
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Starting server without database...');
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} (no database)`);
      });
    } else {
      process.exit(1);
    }
  }
}

startServer();
