const db = require('./config/db');

async function migrate() {
  try {
    console.log('Starting migration...');
    
    // Create database if not exists
    await db.query(`CREATE DATABASE IF NOT EXISTS auction_db`);
    console.log('✅ auction_db database ensured');
    
    // Use the database
    await db.query(`USE auction_db`);
    console.log('✅ Using auction_db');

    // Create all tables
    await db.query(`
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
    console.log('✅ Users table ensured');

    await db.query(`
      CREATE TABLE IF NOT EXISTS forces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        logo_url VARCHAR(500) DEFAULT '',
        description TEXT,
        admin_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Forces table ensured');

    await db.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        room_code VARCHAR(10) NOT NULL UNIQUE,
        host_id INT NOT NULL,
        is_public TINYINT(1) DEFAULT 1,
        status ENUM('waiting','active','paused','ended') DEFAULT 'waiting',
        budget_per_user INT DEFAULT 1000,
        bid_timer INT DEFAULT 30,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Rooms table ensured');

    await db.query(`
      CREATE TABLE IF NOT EXISTS room_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        budget_remaining INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_participant (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Room Participants table ensured');

    await db.query(`
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        base_price INT NOT NULL DEFAULT 10,
        image_url VARCHAR(500) DEFAULT '',
        status ENUM('pending','active','sold','unsold') DEFAULT 'pending',
        sold_to INT DEFAULT NULL,
        sold_price INT DEFAULT NULL,
        auction_order INT DEFAULT 0,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (sold_to) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Players table ensured');

    await db.query(`
      CREATE TABLE IF NOT EXISTS bids (
        id INT AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        amount INT NOT NULL,
        bid_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Bids table ensured');

    await db.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        player_id INT NOT NULL,
        price_paid INT NOT NULL,
        purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Teams table ensured');

    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        user_id INT NOT NULL,
        message TEXT NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('✅ Chat Messages table ensured');

    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_war_settings (
        id INT PRIMARY KEY,
        state_json LONGTEXT
      )
    `);
    console.log('✅ Guild War Settings table ensured');

    // Create indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(room_code)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_bids_player ON bids(player_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_bids_room ON bids(room_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_teams_room_user ON teams(room_id, user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_forces_admin ON forces(admin_id)`);
    console.log('✅ All indexes created');

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
