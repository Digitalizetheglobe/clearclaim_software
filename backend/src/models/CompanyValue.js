const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompanyValue = sequelize.define('CompanyValue', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id'
      }
    },
    field_key: {
      type: DataTypes.STRING,
      allowNull: false
    },
    field_value: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    last_updated_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'company_values',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['company_id', 'field_key']
      }
    ]
  });

  return CompanyValue;
};
