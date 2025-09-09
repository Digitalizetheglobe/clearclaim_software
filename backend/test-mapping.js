const { sequelize } = require('./src/config/database');
const CompanyValue = require('./src/models/CompanyValue')(sequelize);
const CaseField = require('./src/models/CaseField')(sequelize);
const Company = require('./src/models/Company')(sequelize);

const testMapping = async () => {
  try {
    console.log('Testing mapping functionality...\n');
    
    // Check if companies exist
    const companies = await Company.findAll();
    console.log(`Found ${companies.length} companies`);
    
    if (companies.length > 0) {
      const company = companies[0];
      console.log(`Testing with company: ${company.name} (ID: ${company.id})\n`);
      
      // Check if case fields exist
      const caseFields = await CaseField.findAll();
      console.log(`Found ${caseFields.length} case fields`);
      
      if (caseFields.length > 0) {
        console.log('Sample case fields:');
        caseFields.slice(0, 5).forEach(field => {
          console.log(`  - ${field.field_key}: ${field.field_label} (${field.field_type})`);
        });
        console.log();
        
        // Check if company values exist
        const companyValues = await CompanyValue.findAll({
          where: { company_id: company.id }
        });
        console.log(`Found ${companyValues.length} company values for company ${company.id}`);
        
        if (companyValues.length > 0) {
          console.log('Sample company values:');
          companyValues.slice(0, 5).forEach(cv => {
            console.log(`  - ${cv.field_key}: ${cv.value}`);
          });
          console.log();
          
          // Test the association
          const companyValuesWithFields = await CompanyValue.findAll({
            where: { company_id: company.id },
            include: [
              {
                model: CaseField,
                as: 'caseField',
                attributes: ['field_key', 'field_label', 'field_type']
              }
            ]
          });
          
          console.log(`Found ${companyValuesWithFields.length} company values with case field associations`);
          
          if (companyValuesWithFields.length > 0) {
            console.log('Sample associations:');
            companyValuesWithFields.slice(0, 3).forEach(cv => {
              if (cv.caseField) {
                console.log(`  - ${cv.field_key} (${cv.value}) → CaseField: ${cv.caseField.field_label}`);
              } else {
                console.log(`  - ${cv.field_key} (${cv.value}) → No case field association`);
              }
            });
          }
        } else {
          console.log('No company values found. You need to add some values first.');
        }
      } else {
        console.log('No case fields found. You need to create case fields first.');
      }
    } else {
      console.log('No companies found. You need to create companies first.');
    }
    
  } catch (error) {
    console.error('Error testing mapping:', error);
  } finally {
    await sequelize.close();
  }
};

testMapping();
