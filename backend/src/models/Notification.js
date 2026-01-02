const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'companies',
        key: 'id'
      }
    },
    case_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'cases',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('data_review_approved', 'data_review_rejected', 'template_review_approved', 'template_review_rejected', 'review_completed', 'feedback_received'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional data like reviewer name, case name, etc.'
    }
  }, {
    tableName: 'notifications',
    timestamps: true
  });

  return Notification;
};

