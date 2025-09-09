const { sequelize } = require('./src/config/database');

async function createCompanyTemplatesTable() {
  try {
    console.log('🔄 Creating company_templates table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS company_templates (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        template_category VARCHAR(100) NOT NULL,
        template_path VARCHAR(500) NOT NULL,
        is_selected BOOLEAN DEFAULT TRUE,
        selected_by INTEGER,
        selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (selected_by) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    // Create indexes separately for PostgreSQL
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_company_templates_company_id ON company_templates(company_id);
      CREATE INDEX IF NOT EXISTS idx_company_templates_category ON company_templates(template_category);
      CREATE INDEX IF NOT EXISTS idx_company_templates_selected ON company_templates(is_selected);
    `);
    
    console.log('✅ company_templates table created successfully!');
    
    // Insert default templates based on the template files
    console.log('🔄 Inserting default template definitions...');
    
    const defaultTemplates = [
      // Name Mismatch Templates
      { name: 'Name Mismatch Claimant 1', category: 'NAME_MISMATCH', path: 'Name Mismatch SELF Affidavit_C1_Template.docx' },
      { name: 'Name Mismatch Claimant 2', category: 'NAME_MISMATCH', path: 'Name Mismatch SELF Affidavit_C2_Template.docx' },
      { name: 'Name Mismatch Claimant 3', category: 'NAME_MISMATCH', path: 'Name Mismatch SELF Affidavit_C3_Template.docx' },
      { name: 'Name Mismatch Claimant 4', category: 'NAME_MISMATCH', path: 'Name Mismatch SELF Affidavit_C4_Template.docx' },
      { name: 'Name Mismatch Dead Holder 1', category: 'NAME_MISMATCH', path: 'Name Mismatch DEATH Affidavit_H1_Template.docx' },
      { name: 'Name Mismatch Dead Holder 2', category: 'NAME_MISMATCH', path: 'Name Mismatch DEATH Affidavit_H2_Template.docx' },
      { name: 'Name Mismatch Dead Holder 3', category: 'NAME_MISMATCH', path: 'Name Mismatch DEATH Affidavit_H3_Template.docx' },
      { name: 'Name Mismatch Dead Holder 4', category: 'NAME_MISMATCH', path: 'Name Mismatch DEATH Affidavit_H4_Template.docx' },
      { name: 'Name Mismatch DEATH Affidavit', category: 'NAME_MISMATCH', path: 'Name Mismatch DEATH Affidavit_Template.docx' },
      
      // KYC Templates
      { name: 'ISR1', category: 'KYC', path: 'ISR-1_Template.docx' },
      { name: 'ISR2 - Claimant 1', category: 'KYC', path: 'ISR-2_Bank_Single_C1_Template.docx' },
      { name: 'ISR2 - Claimant 2', category: 'KYC', path: 'ISR-2_Bank_Single_C2_Template.docx' },
      { name: 'ISR2 - Claimant 3', category: 'KYC', path: 'ISR-2_Bank_Single_C3_Template.docx' },
      { name: 'ISR2 - Joint All', category: 'KYC', path: 'ISR-2_Bank_Joint_Template.docx' },
      { name: 'SH13', category: 'KYC', path: 'SH-13_Template.docx' },
      
      // DUP Templates
      { name: 'ISR4', category: 'DUP', path: 'ISR-4_Template.docx' },
      
      // Form A Templates
      { name: 'Form A - Self Single', category: 'FORM_A', path: 'Form-A (Affidavit)- SELF_Single_Template.docx' },
      { name: 'Form A - Self Multiple', category: 'FORM_A', path: 'Form-A (Affidavit)- SELF_Multiple_Template.docx' },
      { name: 'Form A - NAME DEL Single', category: 'FORM_A', path: 'Form-A (Affidavit)- NDEL_Single_Template.docx' },
      { name: 'Form A - NAME DEL Multiple', category: 'FORM_A', path: 'Form-A (Affidavit)- NDEL_All_Template.docx' },
      { name: 'Form A - TRANS Single', category: 'FORM_A', path: 'Form-A (Affidavit)- TRANS_Single_Template.docx' },
      { name: 'Form A - TRANS Multiple', category: 'FORM_A', path: 'Form-A (Affidavit)- TRANS_All_Template.docx' },
      
      // Form B Templates
      { name: 'Form B - Self Single', category: 'FORM_B', path: 'Form-B (Indemnity)- SELF_Single_Template.docx' },
      { name: 'Form B - Self Multiple', category: 'FORM_B', path: 'Form-B (Indemnity)- SELF_Multiple_Template.docx' },
      { name: 'Form B - NAME DEL Single', category: 'FORM_B', path: 'Form-B (Indemnity)- NDEL_Single_Template.docx' },
      { name: 'Form B - NAME DEL Multiple', category: 'FORM_B', path: 'Form-B (Indemnity)- NDEL_All_Template.docx' },
      { name: 'Form B - TRANS Single', category: 'FORM_B', path: 'Form-B (Indemnity)- TRANS_Single_Template.docx' },
      { name: 'Form B - TRANS Multiple', category: 'FORM_B', path: 'Form-B (Indemnity)- TRANS_All_Template.docx' },
      
      // TRN Templates
      { name: 'ISR5', category: 'TRN', path: 'ISR-5_Template.docx' },
      { name: 'Annexure - D Claimant 1', category: 'TRN', path: 'Annexure-D (Individual Affidavit)_C1_Template (2).docx' },
      { name: 'Annexure - D Claimant 2', category: 'TRN', path: 'Annexure-D (Individual Affidavit)_C2_Template.docx' },
      { name: 'Annexure - D Claimant 3', category: 'TRN', path: 'Annexure-D (Individual Affidavit)_C3_Template.docx' },
      { name: 'Annexure - D LH1', category: 'TRN', path: 'Annexure-D (Individual Affidavit)_LH1_Template.docx' },
      { name: 'Annexure - D LH2', category: 'TRN', path: 'Annexure-D (Individual Affidavit)_LH2_Template.docx' },
      { name: 'Annexure - D LH3', category: 'TRN', path: 'Annexure-D (Individual Affidavit)_LH3_Template.docx' },
      { name: 'Annexure - D LH4', category: 'TRN', path: 'Annexure-D (Individual Affidavit)_LH4_Template.docx' },
      { name: 'Annexure - D LH5', category: 'TRN', path: 'Annexure-D (Individual Affidavit)_LH5_Template.docx' },
      { name: 'Indemnity - E All', category: 'TRN', path: 'Annexure-E (Indemnity Bond)_Template.docx' },
      { name: 'Annexure - F All', category: 'TRN', path: 'Annexure-F (Noc from other legal heirs)_Template.docx' }
    ];
    
    for (const template of defaultTemplates) {
      await sequelize.query(`
        INSERT IGNORE INTO company_templates (template_name, template_category, template_path) 
        VALUES (?, ?, ?)
      `, {
        replacements: [template.name, template.category, template.path]
      });
    }
    
    console.log(`✅ Inserted ${defaultTemplates.length} default template definitions!`);
    
  } catch (error) {
    console.error('❌ Error creating company_templates table:', error);
  } finally {
    await sequelize.close();
  }
}

createCompanyTemplatesTable();
