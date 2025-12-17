const { Sequelize } = require('sequelize');
require('dotenv').config();

// Support both DATABASE_URL and individual DB variables
let sequelize;

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided (common in production/cloud environments)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: process.env.DB_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require') ? {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    } : {}
  });
} else if (process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASS) {
  // Fall back to individual DB variables
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true
      },
      dialectOptions: process.env.DB_SSL === 'true' ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}
    }
  );
} else {
  throw new Error(
    'Database configuration missing. Please provide either DATABASE_URL or ' +
    'individual DB variables (DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_PORT) in your .env file.'
  );
}

module.exports = { sequelize };



















// const { Sequelize } = require('sequelize');
// require('dotenv').config();

// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PASS,
//   {
//     host: process.env.DB_HOST,
//     port: process.env.DB_PORT,
//     dialect: 'postgres',
//     logging: process.env.NODE_ENV === 'development' ? console.log : false,
//     pool: {
//       max: 5,
//       min: 0,
//       acquire: 30000,
//       idle: 10000
//     },
//     define: {
//       timestamps: true,
//       underscored: true,
//       freezeTableName: true
//     },
//     dialectOptions: process.env.DB_SSL === 'true' ? {
//       ssl: {
//         require: true,
//         rejectUnauthorized: false
//       }
//     } : {}
//   }
// );

// module.exports = { sequelize };
