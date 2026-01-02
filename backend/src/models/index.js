const { sequelize } = require('../config/database');

// Import model definitions
const User = require('./User')(sequelize);
const Case = require('./Case')(sequelize);
const Activity = require('./Activity')(sequelize);
const CaseField = require('./CaseField')(sequelize);
const CaseValue = require('./CaseValue')(sequelize);
const Company = require('./Company')(sequelize);
const CompanyValue = require('./CompanyValue')(sequelize);
const Claimant = require('./Claimant')(sequelize);
const CompanyTemplate = require('./CompanyTemplate')(sequelize);
const Notification = require('./Notification')(sequelize);

// User - Case associations
User.hasMany(Case, { 
  foreignKey: 'created_by', 
  as: 'createdCases' 
});
User.hasMany(Case, { 
  foreignKey: 'assigned_to', 
  as: 'assignedCases' 
});
Case.belongsTo(User, { 
  foreignKey: 'created_by', 
  as: 'createdByUser' 
});
Case.belongsTo(User, { 
  foreignKey: 'assigned_to', 
  as: 'assignedUser' 
});

// Case - CaseValue associations
Case.hasMany(CaseValue, { 
  foreignKey: 'case_id', 
  as: 'caseValues' 
});
CaseValue.belongsTo(Case, { 
  foreignKey: 'case_id' 
});

// User - CaseValue associations
User.hasMany(CaseValue, { 
  foreignKey: 'last_updated_by', 
  as: 'updatedCaseValues' 
});
CaseValue.belongsTo(User, { 
  foreignKey: 'last_updated_by', 
  as: 'lastUpdatedByUser' 
});

// CaseField - CaseValue associations (for reference)
CaseField.hasMany(CaseValue, { 
  foreignKey: 'field_key', 
  sourceKey: 'field_key',
  as: 'caseValues' 
});
CaseValue.belongsTo(CaseField, { 
  foreignKey: 'field_key', 
  targetKey: 'field_key',
  as: 'caseField' 
});

// Case - Company associations
Case.hasMany(Company, { 
  foreignKey: 'case_id', 
  as: 'companies' 
});
Company.belongsTo(Case, { 
  foreignKey: 'case_id', 
  as: 'case' 
});

// User - Company associations
User.hasMany(Company, { 
  foreignKey: 'created_by', 
  as: 'createdCompanies' 
});
User.hasMany(Company, { 
  foreignKey: 'assigned_to', 
  as: 'assignedCompanies' 
});
Company.belongsTo(User, { 
  foreignKey: 'created_by', 
  as: 'createdByUser' 
});
Company.belongsTo(User, { 
  foreignKey: 'assigned_to', 
  as: 'assignedUser' 
});

// Company - CompanyValue associations
Company.hasMany(CompanyValue, { 
  foreignKey: 'company_id', 
  as: 'companyValues' 
});
CompanyValue.belongsTo(Company, { 
  foreignKey: 'company_id' 
});

// User - CompanyValue associations
User.hasMany(CompanyValue, { 
  foreignKey: 'last_updated_by', 
  as: 'updatedCompanyValues' 
});
CompanyValue.belongsTo(User, { 
  foreignKey: 'last_updated_by', 
  as: 'lastUpdatedByUser' 
});

// CaseField - CompanyValue associations (for reference)
CaseField.hasMany(CompanyValue, { 
  foreignKey: 'field_key', 
  sourceKey: 'field_key',
  as: 'companyValues' 
});
CompanyValue.belongsTo(CaseField, { 
  foreignKey: 'field_key', 
  targetKey: 'field_key',
  as: 'caseField' 
});

// Company - Claimant associations
Company.hasMany(Claimant, { 
  foreignKey: 'company_id', 
  as: 'claimants' 
});
Claimant.belongsTo(Company, { 
  foreignKey: 'company_id' 
});

// Company - CompanyTemplate associations
Company.hasMany(CompanyTemplate, { 
  foreignKey: 'company_id', 
  as: 'companyTemplates' 
});
CompanyTemplate.belongsTo(Company, { 
  foreignKey: 'company_id' 
});

// User - CompanyTemplate associations
User.hasMany(CompanyTemplate, { 
  foreignKey: 'selected_by', 
  as: 'selectedTemplates' 
});
CompanyTemplate.belongsTo(User, { 
  foreignKey: 'selected_by', 
  as: 'selectedByUser' 
});

// User - Claimant associations
User.hasMany(Claimant, { 
  foreignKey: 'created_by', 
  as: 'createdClaimants' 
});
User.hasMany(Claimant, { 
  foreignKey: 'last_updated_by', 
  as: 'updatedClaimants' 
});
Claimant.belongsTo(User, { 
  foreignKey: 'created_by', 
  as: 'createdByUser' 
});
Claimant.belongsTo(User, { 
  foreignKey: 'last_updated_by', 
  as: 'lastUpdatedByUser' 
});

// User - Notification associations
User.hasMany(Notification, { 
  foreignKey: 'user_id', 
  as: 'notifications' 
});
Notification.belongsTo(User, { 
  foreignKey: 'user_id', 
  as: 'user' 
});

// Company - Notification associations
Company.hasMany(Notification, { 
  foreignKey: 'company_id', 
  as: 'notifications' 
});
Notification.belongsTo(Company, { 
  foreignKey: 'company_id', 
  as: 'company' 
});

// Case - Notification associations
Case.hasMany(Notification, { 
  foreignKey: 'case_id', 
  as: 'notifications' 
});
Notification.belongsTo(Case, { 
  foreignKey: 'case_id', 
  as: 'case' 
});

module.exports = {
  User,
  Case,
  Activity,
  CaseField,
  CaseValue,
  Company,
  CompanyValue,
  Claimant,
  CompanyTemplate,
  Notification
};
