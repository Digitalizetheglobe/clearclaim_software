const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CompanyNote = sequelize.define(
    'CompanyNote',
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
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      },
      note: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    },
    {
      tableName: 'company_notes',
      timestamps: true
    }
  );

  return CompanyNote;
};
