const { DataTypes } = require('sequelize');

// Valid options for Type of Unclaimed Investments
const INVESTMENT_TYPES = [
  'Shares Recovery',
  'Mutual Funds Redemption',
  'Insurance Claim Recovery',
  'Provident Funds Recovery',
  'Debtor Recovery',
  'Unclaimed Bank Deposits',
  'Property Dispute',
  'Litigation Funding Consulting'
];

// Valid callback time slots (IST)
const CALLBACK_TIME_SLOTS = [
  '10:00 AM-11:00 AM',
  '11:00 AM-12:00 PM',
  '12:00 PM-1:00 PM',
  '2:00 PM-3:00 PM',
  '3:00 PM-4:00 PM',
  '4:00 PM-5:00 PM',
  '5:00 PM-6:00 PM',
  '6:00 PM-7:00 PM'
];

module.exports = (sequelize) => {
  const Inquiry = sequelize.define('Inquiry', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    country_of_residence: {
      type: DataTypes.STRING,
      allowNull: false
    },
    whatsapp_number: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type_of_unclaimed_investments: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'One of: Shares Recovery, Mutual Funds Redemption, etc.'
    },
    preferred_callback_time: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'IST time slot e.g. 10:00 AM-11:00 AM'
    }
  }, {
    tableName: 'inquiries',
    timestamps: true
  });

  Inquiry.INVESTMENT_TYPES = INVESTMENT_TYPES;
  Inquiry.CALLBACK_TIME_SLOTS = CALLBACK_TIME_SLOTS;
  return Inquiry;
};
