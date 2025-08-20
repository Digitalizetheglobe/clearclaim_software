const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Activity = sequelize.define('Activity', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    // Foreign keys will be added later when associations are set up
    metadata: {
      type: DataTypes.TEXT,
      defaultValue: '{}'
    }
  }, {
    tableName: 'activities'
  });

  return Activity;
};
