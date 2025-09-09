const { sequelize } = require('./src/config/database');

async function testModels() {
  try {
    console.log('🔄 Testing models...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Test models import
    const models = require('./src/models');
    console.log('✅ Models imported successfully');
    console.log('Available models:', Object.keys(models));
    
    // Test CompanyTemplate specifically
    if (models.CompanyTemplate) {
      console.log('✅ CompanyTemplate model found');
      console.log('CompanyTemplate type:', typeof models.CompanyTemplate);
      console.log('CompanyTemplate methods:', Object.getOwnPropertyNames(models.CompanyTemplate.prototype));
    } else {
      console.log('❌ CompanyTemplate model NOT found');
    }
    
    // Test if we can query the table
    try {
      const result = await sequelize.query('SELECT COUNT(*) FROM company_templates');
      console.log('✅ company_templates table exists, count:', result[0][0].count);
    } catch (error) {
      console.log('❌ company_templates table error:', error.message);
    }
    
    // Test controller functions
    console.log('\n🔄 Testing controller functions...');
    try {
      const controller = require('./src/controllers/companyTemplateController');
      console.log('✅ Controller imported successfully');
      console.log('Available functions:', Object.keys(controller));
      
      // Check each function
      ['getCompanyTemplates', 'updateCompanyTemplates', 'downloadTemplate', 'getTemplateStats'].forEach(funcName => {
        if (controller[funcName] && typeof controller[funcName] === 'function') {
          console.log(`✅ ${funcName}: function`);
        } else {
          console.log(`❌ ${funcName}: ${typeof controller[funcName]}`);
        }
      });
      
    } catch (error) {
      console.log('❌ Controller import error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing models:', error);
  } finally {
    await sequelize.close();
  }
}

testModels();
