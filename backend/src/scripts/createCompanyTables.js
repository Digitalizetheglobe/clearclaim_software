const { sequelize } = require('../config/database');
const { Company, CompanyValue } = require('../models');

async function createCompanyTables() {
  try {
    console.log('Creating company tables...');
    
    // Sync the new models
    await Company.sync({ force: false });
    await CompanyValue.sync({ force: false });
    
    console.log('Company tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating company tables:', error);
    process.exit(1);
  }
}

createCompanyTables();
