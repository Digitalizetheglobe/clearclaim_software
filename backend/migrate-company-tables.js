const { sequelize } = require('./src/config/database');
require('./src/models'); // This will load all models and associations

async function migrateCompanyTables() {
  try {
    console.log('Starting company tables migration...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Sync all models (this will create missing tables)
    await sequelize.sync({ alter: true });
    console.log('✅ Database tables synchronized successfully');
    
    console.log('🎉 Company tables migration completed successfully!');
    console.log('📋 Created/Updated tables:');
    console.log('   - companies');
    console.log('   - company_values');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

migrateCompanyTables();
