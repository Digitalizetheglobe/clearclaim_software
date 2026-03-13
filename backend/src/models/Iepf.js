const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Iepf = sequelize.define('Iepf', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'iepf_forms',
    timestamps: true
  });

  return Iepf;
};
