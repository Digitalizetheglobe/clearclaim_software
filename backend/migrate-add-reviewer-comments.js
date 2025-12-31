const { sequelize } = require('./src/config/database');

async function addReviewerComments() {
  try {
    console.log('🔄 Checking if reviewer_comment column exists in company_values table...');
    
    // First check if column exists
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'company_values' 
      AND column_name = 'reviewer_comment';
    `);

    if (results.length > 0) {
      console.log('✅ Column reviewer_comment already exists in company_values table');
      return;
    }

    console.log('📝 Adding reviewer_comment column to company_values table...');
    
    // Add reviewer_comment column to company_values table
    await sequelize.query(`
      ALTER TABLE company_values 
      ADD COLUMN reviewer_comment TEXT;
    `);

    // Add comment to the column
    await sequelize.query(`
      COMMENT ON COLUMN company_values.reviewer_comment IS 'Comments from data reviewer about this specific field';
    `);

    console.log('✅ Reviewer comment field added successfully to company_values table');
  } catch (error) {
    console.error('❌ Error adding reviewer comment field:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addReviewerComments()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

