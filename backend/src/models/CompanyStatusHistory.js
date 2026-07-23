const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompanyStatusHistory = sequelize.define(
    'CompanyStatusHistory',
    {
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
      from_status: {
        type: DataTypes.STRING,
        allowNull: true
      },
      to_status: {
        type: DataTypes.STRING,
        allowNull: false
      },
      changed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      change_source: {
        type: DataTypes.STRING(80),
        allowNull: true,
        comment: 'manual | create | data_approve | data_reject | template_submit | template_approve | template_reject | assign_data_review'
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      tableName: 'company_status_history',
      timestamps: true,
      updatedAt: false
    }
  );

  return CompanyStatusHistory;
};
