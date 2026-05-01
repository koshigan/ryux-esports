// config/db.js - MySQL database connection pool (Aiven FIXED)
const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_NAME = process.env.DB_NAME || 'auction_db';

// Create pool without database first
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
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

// Auto-create database and tables on startup
(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log("✅ MySQL connected successfully (Aiven)");
    
    // Create database if not exists
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database ${DB_NAME} ready`);
    
    // Use the database
    await conn.query(`USE ${DB_NAME}`);
    
    // Create tables
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        avatar VARCHAR(10) DEFAULT '🧑',
        is_admin TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ users table ready');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS guild_war_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        state_json TEXT DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ guild_war_settings table ready');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        room_code VARCHAR(10) NOT NULL UNIQUE,
        host_id INT NOT NULL,
        is_public TINYINT(1) DEFAULT 1,
        status ENUM('waiting','active','paused','ended') DEFAULT 'waiting',
        budget_per_user INT DEFAULT 1000,
        bid_timer INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ rooms table ready');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS room_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        budget_remaining INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_participant (room_id, user_id)
      )
    `);
    console.log('✅ room_participants table ready');
    
    conn.release();
    console.log('🎉 Database setup complete!');
  } catch (err) {
    console.error("❌ MySQL connection failed:", {
      message: err.message,
      code: err.code,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER
    });
    if (conn) conn.release();
  }
})();

module.exports = pool;