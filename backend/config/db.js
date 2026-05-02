const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'auction_db';

// Create pool with database name to ensure all connections use it
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

// Debug log
console.log(`📡 Connecting to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${DB_NAME}`);

// Auto-create database and tables on startup
async function initializeDatabase() {
  let conn;
  try {
    // We try to get a connection. If the database doesn't exist, this might fail.
    // However, on Aiven/Render, the DB_NAME (usually 'defaultdb') already exists.
    try {
      conn = await pool.getConnection();
    } catch (err) {
      if (err.code === 'ER_BAD_DB_ERROR') {
        console.log(`⚠️ Database ${DB_NAME} not found, attempting to create...`);
        // Connect without database to create it
        const tempConn = await mysql.createConnection({
          host: process.env.DB_HOST,
          user: process.env.DB_USER,
          password: process.env.DB_PASS,
          port: process.env.DB_PORT,
          ssl: { rejectUnauthorized: false }
        });
        await tempConn.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await tempConn.end();
        console.log(`✅ Database ${DB_NAME} created.`);
        conn = await pool.getConnection();
      } else {
        throw err;
      }
    }

    console.log("✅ MySQL connected successfully");
    
    // Use the database (redundant if pool has it, but safe)
    await conn.query(`USE ${DB_NAME}`);
    
    // Create tables
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(10) DEFAULT '🧑',
        is_admin TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS guild_war_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        state_json LONGTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        room_code VARCHAR(10) NOT NULL UNIQUE,
        host_id INT NOT NULL,
        is_public TINYINT(1) DEFAULT 1,
        status ENUM('waiting','active','paused','ended') DEFAULT 'waiting',
        budget_per_user INT DEFAULT 1000,
        bid_timer INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS room_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        budget_remaining INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_participant (room_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS forces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        logo_url VARCHAR(500) DEFAULT '',
        description TEXT DEFAULT '',
        admin_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      await conn.query(sql);
    }
    
    console.log('🎉 Database setup complete!');
    conn.release();
  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
    if (conn) conn.release();
  }
}

// Run initialization
initializeDatabase();

module.exports = pool;