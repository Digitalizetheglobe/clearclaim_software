const { sequelize } = require('./src/config/database');

async function migrateRoleColumnToJsonb() {
  try {
    console.log('🔄 Starting database migration: Converting role column from ENUM to JSONB...');

    // Step 1: Add a new temporary column for JSONB
    await sequelize.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS role_new JSONB DEFAULT '["employee"]'::jsonb;
    `);
    console.log('✅ Added temporary role_new column');

    // Step 2: Migrate existing data from ENUM to JSONB array
    await sequelize.query(`
      UPDATE users 
      SET role_new = jsonb_build_array(role::text)
      WHERE role_new IS NULL OR role_new = '["employee"]'::jsonb;
    `);
    console.log('✅ Migrated existing role data to JSONB arrays');

    // Step 3: Drop the old ENUM column
    await sequelize.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS role;
    `);
    console.log('✅ Dropped old role column');

    // Step 4: Rename the new column to role
    await sequelize.query(`
      ALTER TABLE users RENAME COLUMN role_new TO role;
    `);
    console.log('✅ Renamed role_new to role');

    // Step 5: Set NOT NULL constraint
    await sequelize.query(`
      ALTER TABLE users 
      ALTER COLUMN role SET NOT NULL,
      ALTER COLUMN role SET DEFAULT '["employee"]'::jsonb;
    `);
    console.log('✅ Set NOT NULL and default value');

    console.log('\n✨ Database migration completed successfully!');
    console.log('   All user roles have been converted to JSONB arrays.');
    console.log('   Run migrate-multiple-roles.js to ensure all roles are properly formatted.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    console.error('\n💡 If you get an error about the column already existing,');
    console.error('   you may need to manually clean up the database first.');
    process.exit(1);
  }
}

// Run migration
migrateRoleColumnToJsonb();

