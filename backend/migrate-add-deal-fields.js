const { sequelize } = require('./src/config/database');

async function migrateAddDealFields() {
  try {
    console.log('Starting migration to add deal_id and cp_name fields...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');
    
    // Add new columns to cases table
    await sequelize.query(`
      ALTER TABLE cases 
      ADD COLUMN deal_id VARCHAR(255) NULL,
      ADD COLUMN cp_name VARCHAR(255) NULL
    `);
    
    console.log('✅ Successfully added deal_id and cp_name columns to cases table');
    console.log('📋 Migration completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateAddDealFields();
