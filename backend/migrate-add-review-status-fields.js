const { sequelize } = require('./src/config/database');

async function addReviewStatusFields() {
  try {
    console.log('🔄 Adding review_status and admin_remark fields to company_templates table...');
    
    // Add review_status column
    await sequelize.query(`
      ALTER TABLE company_templates 
      ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT NULL;
    `);
    
    // Add admin_remark column
    await sequelize.query(`
      ALTER TABLE company_templates 
      ADD COLUMN IF NOT EXISTS admin_remark TEXT DEFAULT NULL;
    `);
    
    // Add admin_comment column if it doesn't exist (for safety)
    await sequelize.query(`
      ALTER TABLE company_templates 
      ADD COLUMN IF NOT EXISTS admin_comment TEXT DEFAULT NULL;
    `);
    
    // Add employee_response column if it doesn't exist (for safety)
    await sequelize.query(`
      ALTER TABLE company_templates 
      ADD COLUMN IF NOT EXISTS employee_response TEXT DEFAULT NULL;
    `);
    
    console.log('✅ Review status fields added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding review status fields:', error);
  } finally {
    await sequelize.close();
  }
}

addReviewStatusFields();

