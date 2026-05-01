// config/db.js - MySQL database connection pool (Aiven FIXED)
const mysql = require('mysql2/promise');
require('dotenv').config();

// Create pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  // ✅ FIXED SSL for Aiven
  ssl: {
    rejectUnauthorized: false
  }
});

// Debug log
console.log(`📡 Connecting to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);

// Test connection
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ MySQL connected successfully (Aiven)");
    conn.release();
  } catch (err) {
    console.error("❌ MySQL connection failed:", {
      message: err.message,
      code: err.code,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER
    });
  }
})();

module.exports = pool;