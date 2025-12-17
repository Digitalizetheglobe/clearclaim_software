const { DataTypes } = require('sequelize');

const CompanyTemplate = (sequelize) => {
  const CompanyTemplate = sequelize.define('CompanyTemplate', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    company_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'companies', key: 'id' } },
    template_name: { type: DataTypes.STRING, allowNull: false },
    template_category: { type: DataTypes.STRING, allowNull: false },
    template_path: { type: DataTypes.STRING, allowNull: false },
    is_selected: { type: DataTypes.BOOLEAN, defaultValue: true },
    selected_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
    selected_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    admin_comment: { type: DataTypes.TEXT, allowNull: true },
    admin_remark: { type: DataTypes.TEXT, allowNull: true },
    review_status: { type: DataTypes.STRING(50), allowNull: true },
    employee_response: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'company_templates',
    timestamps: true
  });

  return CompanyTemplate;
};

module.exports = CompanyTemplate;
