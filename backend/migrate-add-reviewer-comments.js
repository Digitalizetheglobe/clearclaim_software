const { sequelize } = require('./src/config/database');

async function addReviewerComments() {
  try {
    // Add reviewer_comment column to company_values table
    await sequelize.query(`
      DO $$ 
      BEGIN
        -- Check if column exists, if not add it
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'company_values' 
          AND column_name = 'reviewer_comment'
        ) THEN
          ALTER TABLE company_values 
          ADD COLUMN reviewer_comment TEXT;
          
          COMMENT ON COLUMN company_values.reviewer_comment IS 'Comments from data reviewer about this specific field';
        END IF;
      END $$;
    `);

    console.log('✅ Reviewer comment field added to company_values table');
  } catch (error) {
    console.error('❌ Error adding reviewer comment field:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

addReviewerComments();

