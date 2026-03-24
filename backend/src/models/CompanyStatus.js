const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompanyStatus = sequelize.define(
    'CompanyStatus',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false
      },
      value: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      color: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: '#6b7280'
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      }
    },
    {
      tableName: 'company_statuses',
      timestamps: true
    }
  );

  return CompanyStatus;
};
