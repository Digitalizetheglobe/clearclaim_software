const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CaseField = sequelize.define('CaseField', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    field_key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    field_label: {
      type: DataTypes.STRING,
      allowNull: false
    },
    field_type: {
      type: DataTypes.ENUM('text', 'number', 'date', 'email', 'phone'),
      defaultValue: 'text'
    },
    field_category: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Category like: client_info, deceased_info, nominee_info, company_info, shares_info, legal_heir_info'
    },
    is_required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'case_fields',
    timestamps: true
  });

  return CaseField;
};
