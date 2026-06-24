const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool(process.env.DATABASE_URL || {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone:          '+07:00',
});

module.exports = pool.promise();
