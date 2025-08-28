const { sequelize } = require('./src/config/database');

async function createClaimantsTable() {
  try {
    // Create claimants table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS claimants (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        claimant_number INTEGER NOT NULL,
        name_as_per_aadhar VARCHAR(255),
        name_as_per_pan VARCHAR(255),
        name_as_per_cml VARCHAR(255),
        name_as_per_bank VARCHAR(255),
        name_as_per_passport VARCHAR(255),
        name_as_per_succession VARCHAR(255),
        name_as_per_cert VARCHAR(255),
        pan_number VARCHAR(255),
        mobile_number VARCHAR(255),
        email_id VARCHAR(255),
        date_of_birth DATE,
        father_name VARCHAR(255),
        age INTEGER,
        deceased_relation VARCHAR(255),
        address TEXT,
        city VARCHAR(255),
        state VARCHAR(255),
        pin_code VARCHAR(255),
        old_address TEXT,
        bank_account_type VARCHAR(255),
        bank_name VARCHAR(255),
        bank_account_number VARCHAR(255),
        bank_branch VARCHAR(255),
        ifsc_code VARCHAR(255),
        bank_address TEXT,
        micr_code VARCHAR(255),
        account_open_date DATE,
        bank_city VARCHAR(255),
        bank_pin_code VARCHAR(255),
        created_by INTEGER NOT NULL REFERENCES users(id),
        last_updated_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(company_id, claimant_number)
      );
    `);

    // Create index for better performance
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_claimants_company_id ON claimants(company_id);
      CREATE INDEX IF NOT EXISTS idx_claimants_created_by ON claimants(created_by);
      CREATE INDEX IF NOT EXISTS idx_claimants_last_updated_by ON claimants(last_updated_by);
    `);

    console.log('✅ Claimants table created successfully');
  } catch (error) {
    console.error('❌ Error creating claimants table:', error);
  } finally {
    await sequelize.close();
  }
}

createClaimantsTable();
