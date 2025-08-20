const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CaseValue = sequelize.define('CaseValue', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    case_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'cases',
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
    tableName: 'case_values',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['case_id', 'field_key']
      }
    ]
  });

  return CaseValue;
};
