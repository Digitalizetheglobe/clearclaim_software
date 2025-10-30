const { sequelize } = require('../src/config/database');
const CompanyTemplate = require('../src/models/CompanyTemplate')(sequelize);
const Company = require('../src/models/Company')(sequelize);
const path = require('path');
const fs = require('fs').promises;

// Helper function to categorize templates
const categorizeTemplate = (filename) => {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes('name mismatch')) {
    return 'NAME_MISMATCH';
  } else if (lowerFilename.includes('form-a') || lowerFilename.includes('form a')) {
    return 'FORM_A';
  } else if (lowerFilename.includes('form-b') || lowerFilename.includes('form b')) {
    return 'FORM_B';
  } else if (lowerFilename.includes('isr-')) {
    return 'ISR_FORMS';
  } else if (lowerFilename.includes('annexure')) {
    return 'ANNEXURES';
  } else if (lowerFilename.includes('address mismatch') || lowerFilename.includes('legal heir') || lowerFilename.includes('indemnity bond')) {
    return 'OTHER';
  } else {
    return 'OTHER';
  }
};

// Helper function to clean template name
const cleanTemplateName = (filename) => {
  return filename
    .replace('_Template.docx', '')
    .replace('.docx', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
};

// Function to analyze template duplicates and conflicts
const analyzeTemplates = async () => {
  try {
    console.log('🔍 Analyzing templates for duplicates and conflicts...');
    
    const templatesDir = path.join(__dirname, '../templates');
    const templateFiles = await fs.readdir(templatesDir);
    const docxFiles = templateFiles.filter(file => 
      file.endsWith('.docx') && 
      !file.startsWith('~$') && 
      !file.includes('BACKUP') &&
      !file.includes('--') // Skip files with double dashes
    );
    
    console.log(`📊 Found ${docxFiles.length} active template files`);
    
    // Group templates by base name
    const templateGroups = {};
    
    docxFiles.forEach(file => {
      // Extract base name (remove version numbers and common suffixes)
      let baseName = file
        .replace(/\.docx$/, '')
        .replace(/\([0-9]+\)/g, '') // Remove (1), (2), etc.
        .replace(/_Template$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!templateGroups[baseName]) {
        templateGroups[baseName] = [];
      }
      templateGroups[baseName].push(file);
    });
    
    // Find duplicates and conflicts
    const duplicates = [];
    const conflicts = [];
    
    Object.entries(templateGroups).forEach(([baseName, files]) => {
      if (files.length > 1) {
        duplicates.push({
          baseName,
          files: files.sort(),
          count: files.length
        });
      }
      
      // Check for naming conflicts
      const hasVersionNumbers = files.some(f => /\([0-9]+\)/.test(f));
      const hasTemplateSuffix = files.some(f => f.includes('_Template'));
      const hasNoTemplateSuffix = files.some(f => !f.includes('_Template'));
      
      if (hasVersionNumbers || (hasTemplateSuffix && hasNoTemplateSuffix)) {
        conflicts.push({
          baseName,
          files: files.sort(),
          issue: hasVersionNumbers ? 'Version numbers' : 'Template suffix inconsistency'
        });
      }
    });
    
    console.log('\n📋 DUPLICATE TEMPLATES FOUND:');
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found');
    } else {
      duplicates.forEach(dup => {
        console.log(`\n🔄 ${dup.baseName} (${dup.count} versions):`);
        dup.files.forEach(file => {
          console.log(`  - ${file}`);
        });
      });
    }
    
    console.log('\n⚠️ NAMING CONFLICTS:');
    if (conflicts.length === 0) {
      console.log('✅ No naming conflicts found');
    } else {
      conflicts.forEach(conflict => {
        console.log(`\n🚨 ${conflict.baseName} (${conflict.issue}):`);
        conflict.files.forEach(file => {
          console.log(`  - ${file}`);
        });
      });
    }
    
    // Show new templates
    console.log('\n🆕 NEW TEMPLATES DETECTED:');
    const newTemplates = docxFiles.filter(file => 
      file.includes('Address mismatch') ||
      file.includes('IndemnityBond_IEPF') ||
      file.includes('Legal_Heir_Certificate') ||
      file.includes('SH13.docx') ||
      file.includes('ISR-5_Template- Joint') ||
      file.includes('ISR-5_Template- Single')
    );
    
    if (newTemplates.length === 0) {
      console.log('No new templates detected');
    } else {
      newTemplates.forEach(file => {
        const category = categorizeTemplate(file);
        const cleanName = cleanTemplateName(file);
        console.log(`  - ${file} (Category: ${category})`);
      });
    }
    
    return {
      totalFiles: docxFiles.length,
      duplicates,
      conflicts,
      newTemplates
    };
    
  } catch (error) {
    console.error('❌ Error analyzing templates:', error);
    return null;
  }
};

// Function to clean up templates
const cleanupTemplates = async () => {
  try {
    console.log('🧹 Starting template cleanup...');
    
    const templatesDir = path.join(__dirname, '../templates');
    const templateFiles = await fs.readdir(templatesDir);
    
    // Find backup files
    const backupFiles = templateFiles.filter(file => 
      file.includes('BACKUP') || 
      file.includes('--') ||
      file.startsWith('~$')
    );
    
    console.log(`🗑️ Found ${backupFiles.length} backup/temp files:`);
    backupFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    // Ask for confirmation before deletion
    console.log('\n⚠️ These files can be safely deleted. They are backup/temporary files.');
    console.log('To delete them, run: node cleanupTemplates.js delete-backups');
    
    return backupFiles;
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    return [];
  }
};

// Function to delete backup files
const deleteBackupFiles = async () => {
  try {
    console.log('🗑️ Deleting backup files...');
    
    const templatesDir = path.join(__dirname, '../templates');
    const templateFiles = await fs.readdir(templatesDir);
    
    const backupFiles = templateFiles.filter(file => 
      file.includes('BACKUP') || 
      file.includes('--') ||
      file.startsWith('~$')
    );
    
    for (const file of backupFiles) {
      const filePath = path.join(templatesDir, file);
      await fs.unlink(filePath);
      console.log(`✅ Deleted: ${file}`);
    }
    
    console.log(`🎉 Cleaned up ${backupFiles.length} backup files`);
    
  } catch (error) {
    console.error('❌ Error deleting backup files:', error);
  }
};

// Function to update database with new templates
const updateDatabaseWithNewTemplates = async () => {
  try {
    console.log('🔄 Updating database with new templates...');
    
    // Get all companies
    const companies = await Company.findAll();
    console.log(`📊 Found ${companies.length} companies`);
    
    if (companies.length === 0) {
      console.log('⚠️ No companies found. Please create companies first.');
      return;
    }
    
    // Get current templates in database
    const existingTemplates = await CompanyTemplate.findAll({
      attributes: ['template_path'],
      group: ['template_path']
    });
    
    const existingPaths = existingTemplates.map(t => t.template_path);
    console.log(`📋 Found ${existingPaths.length} existing templates in database`);
    
    // Scan templates directory
    const templatesDir = path.join(__dirname, '../templates');
    const templateFiles = await fs.readdir(templatesDir);
    const docxFiles = templateFiles.filter(file => 
      file.endsWith('.docx') && 
      !file.startsWith('~$') && 
      !file.includes('BACKUP') &&
      !file.includes('--')
    );
    
    // Find new templates
    const newTemplates = docxFiles.filter(file => !existingPaths.includes(file));
    
    console.log(`🆕 Found ${newTemplates.length} new templates:`);
    newTemplates.forEach(file => {
      const category = categorizeTemplate(file);
      const cleanName = cleanTemplateName(file);
      console.log(`  - ${file} (Category: ${category})`);
    });
    
    if (newTemplates.length === 0) {
      console.log('✅ No new templates to add to database');
      return;
    }
    
    // Add new templates to database for all companies
    for (const company of companies) {
      const templateRecords = [];
      
      for (const file of newTemplates) {
        const category = categorizeTemplate(file);
        const templateName = cleanTemplateName(file);
        
        templateRecords.push({
          company_id: company.id,
          template_name: templateName,
          template_category: category,
          template_path: file,
          is_selected: false,
          selected_by: null,
          selected_at: null
        });
      }
      
      if (templateRecords.length > 0) {
        await CompanyTemplate.bulkCreate(templateRecords);
        console.log(`✅ Added ${templateRecords.length} new templates for company ${company.id}`);
      }
    }
    
    console.log(`🎉 Database update completed! Added ${newTemplates.length} new templates for ${companies.length} companies`);
    
  } catch (error) {
    console.error('❌ Error updating database:', error);
  } finally {
    await sequelize.close();
  }
};

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'analyze') {
  analyzeTemplates();
} else if (command === 'cleanup') {
  cleanupTemplates();
} else if (command === 'delete-backups') {
  deleteBackupFiles();
} else if (command === 'update-db') {
  updateDatabaseWithNewTemplates();
} else {
  console.log('Template Management Script');
  console.log('');
  console.log('Usage:');
  console.log('  node cleanupTemplates.js analyze           - Analyze templates for duplicates and conflicts');
  console.log('  node cleanupTemplates.js cleanup           - Show backup files that can be deleted');
  console.log('  node cleanupTemplates.js delete-backups    - Delete backup files');
  console.log('  node cleanupTemplates.js update-db         - Update database with new templates');
  console.log('');
  console.log('Examples:');
  console.log('  node cleanupTemplates.js analyze');
  console.log('  node cleanupTemplates.js update-db');
}
