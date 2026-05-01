-- ============================================================
-- AUCTION APP - DATABASE SETUP
-- Run this file once to create all tables
-- ============================================================

CREATE DATABASE IF NOT EXISTS auction_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auction_db;

-- -------------------------------------------------------
-- USERS TABLE: Stores registered user accounts
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,           -- bcrypt hashed
  avatar VARCHAR(10) DEFAULT '🧑',          -- emoji avatar
  is_admin TINYINT(1) DEFAULT 0,            -- 1=admin, 0=user
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- FORCES TABLE: Guilds/Factions with logos
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS forces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  logo_url VARCHAR(500) DEFAULT '',         -- URL or path to logo image
  description TEXT DEFAULT '',
  admin_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- ROOMS TABLE: Auction rooms created by hosts
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  room_code VARCHAR(10) NOT NULL UNIQUE,    -- 6-char join code
  host_id INT NOT NULL,
  is_public TINYINT(1) DEFAULT 1,           -- 1=public, 0=private
  status ENUM('waiting','active','paused','ended') DEFAULT 'waiting',
  budget_per_user INT DEFAULT 1000,         -- virtual coins
  bid_timer INT DEFAULT 30,                 -- seconds per bid
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- ROOM PARTICIPANTS: Which users joined which rooms
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  user_id INT NOT NULL,
  budget_remaining INT NOT NULL,            -- coins left
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_participant (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- PLAYERS TABLE: Players to be auctioned in a room
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS players (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) DEFAULT 'General',   -- Batsman, Bowler, etc.
  base_price INT NOT NULL DEFAULT 10,
  image_url VARCHAR(500) DEFAULT '',        -- player image URL
  status ENUM('pending','active','sold','unsold') DEFAULT 'pending',
  sold_to INT DEFAULT NULL,                 -- user_id of winner
  sold_price INT DEFAULT NULL,
  auction_order INT DEFAULT 0,              -- order in auction
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sold_to) REFERENCES users(id) ON DELETE SET NULL
);

-- -------------------------------------------------------
-- BIDS TABLE: All bids placed during auction
-- -------------------------------------------------------
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
);

-- -------------------------------------------------------
-- TEAMS TABLE: Purchased players per user per room
-- -------------------------------------------------------
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
);

-- -------------------------------------------------------
-- CHAT MESSAGES TABLE: In-room chat
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------
-- GUILD WAR SETTINGS: Guild war state storage
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS guild_war_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  state_json TEXT DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- INDEXES for performance
-- -------------------------------------------------------
CREATE INDEX idx_rooms_code ON rooms(room_code);
CREATE INDEX idx_players_room ON players(room_id);
CREATE INDEX idx_bids_player ON bids(player_id);
CREATE INDEX idx_bids_room ON bids(room_id);
CREATE INDEX idx_teams_room_user ON teams(room_id, user_id);
CREATE INDEX idx_chat_room ON chat_messages(room_id);
CREATE INDEX idx_forces_admin ON forces(admin_id);

-- -------------------------------------------------------
-- SAMPLE DATA (optional - for testing)
-- -------------------------------------------------------
-- INSERT INTO users (name, email, password, avatar)
-- VALUES ('Test Host', 'host@test.com', '$2a$10$...hashed...', '👑');

SELECT 'Database setup complete! ✅' AS status;
