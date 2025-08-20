const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Case = sequelize.define('Case', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    case_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    client_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    client_mobile: {
      type: DataTypes.STRING,
      allowNull: false
    },
    client_email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    case_title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    deal_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    cp_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'assigned', 'in_review', 'completed'),
      defaultValue: 'pending'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'cases',
    timestamps: true
  });

  return Case;
};
