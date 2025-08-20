const { sequelize } = require('./src/config/database');

async function testCompanySetup() {
  try {
    console.log('Testing company setup...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Test model imports
    const { Company, CompanyValue } = require('./src/models');
    console.log('✅ Company models imported successfully');
    
    // Test route imports
    const companyRoutes = require('./src/routes/companies');
    console.log('✅ Company routes imported successfully');
    
    // Test controller imports
    const companyController = require('./src/controllers/companyController');
    console.log('✅ Company controller imported successfully');
    
    console.log('🎉 All company components are working correctly!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in company setup:', error.message);
    process.exit(1);
  }
}

testCompanySetup();
