const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Claimant = sequelize.define('Claimant', {
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
    claimant_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Claimant number (1, 2, 3, etc.)'
    },
    // Personal Information
    name_as_per_aadhar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    name_as_per_pan: {
      type: DataTypes.STRING,
      allowNull: true
    },
    name_as_per_cml: {
      type: DataTypes.STRING,
      allowNull: true
    },
    name_as_per_bank: {
      type: DataTypes.STRING,
      allowNull: true
    },
    name_as_per_passport: {
      type: DataTypes.STRING,
      allowNull: true
    },
    name_as_per_succession: {
      type: DataTypes.STRING,
      allowNull: true
    },
    name_as_per_cert: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pan_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    mobile_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    father_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    age: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    deceased_relation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Address Information
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true
    },
    pin_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    old_address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Banking Information
    bank_account_type: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bank_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bank_account_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bank_branch: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ifsc_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bank_address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    micr_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    account_open_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    bank_city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bank_pin_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Metadata
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    last_updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'claimants',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['company_id', 'claimant_number']
      }
    ]
  });

  return Claimant;
};
