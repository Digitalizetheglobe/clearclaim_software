const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.JSONB, // Store as array of roles: ['employee', 'data_reviewer']
      defaultValue: ['employee'],
      allowNull: false
    }
  }, {
    tableName: 'users'
  });

  return User;
};
