const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ShareRecovery = sequelize.define('ShareRecovery', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    mobileNumber: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'share_recoveries',
    timestamps: true
  });

  return ShareRecovery;
};
