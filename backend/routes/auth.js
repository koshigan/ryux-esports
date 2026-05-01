// routes/auth.js - User authentication endpoints
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { validateRegister, sanitize } = require('../middleware/validate');

const router = express.Router();

const guildWarAccounts = [
  { id: 'gw-admin', name: 'RYUX Admin', email: 'admin@ryuxesports.com', password: 'Admin@123', avatar: 'A', role: 'admin', guildTeamId: null },
  { id: 'gw-guild-leader', name: 'Guild Leader', email: 'guildleader@ryuxesports.com', password: 'GuildLeader@123', avatar: 'G', role: 'guild_leader', guildTeamId: null, guildForceId: 'sukuna' },
  { id: 'gw-acting-leader', name: 'Acting Guild Leader', email: 'acting@ryuxesports.com', password: 'Acting@123', avatar: 'A', role: 'force_captain', guildTeamId: null, guildForceId: 'alien' },
  { id: 'gw-supreme-leader', name: 'Supreme Leader', email: 'supreme@ryuxesports.com', password: 'Supreme@123', avatar: 'S', role: 'force_captain', guildTeamId: null, guildForceId: 'das' },
  { id: 'gw-team-1', name: 'Black Bulls Leader', email: 'blackbulls@ryuxesports.com', password: 'BlackBulls@123', avatar: 'B', role: 'war_leader', guildTeamId: 1 },
  { id: 'gw-team-2', name: 'Red Reapers Leader', email: 'redreapers@ryuxesports.com', password: 'RedReapers@123', avatar: 'R', role: 'war_leader', guildTeamId: 2 },
  { id: 'gw-team-3', name: 'Storm Hunters Leader', email: 'stormhunters@ryuxesports.com', password: 'StormHunters@123', avatar: 'S', role: 'war_leader', guildTeamId: 3 }
];

function setSessionUser(req, user) {
  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userAvatar = user.avatar;
  req.session.userRole = user.role || 'admin';
  req.session.guildTeamId = user.guildTeamId || null;
  req.session.guildForceId = user.guildForceId || null;
}

// ── REGISTER ──────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if email already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password with bcrypt (salt rounds = 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Pick a random avatar emoji
    const avatars = ['🧑', '👩', '🦸', '🧙', '🤴', '👸', '🦊', '🐯', '🦁', '🐲'];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];

    // Insert user into database
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, avatar]
    );

    // Auto-login after registration
    setSessionUser(req, {
      id: result.insertId,
      name,
      avatar,
      role: 'admin',
      guildTeamId: null,
      is_admin: 0
    });

    res.json({ success: true, user: { id: result.insertId, name, email, avatar, is_admin: 0 } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const guildWarUser = guildWarAccounts.find((account) => account.email === email);
    if (guildWarUser) {
      if (guildWarUser.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      setSessionUser(req, guildWarUser);
      return res.json({
        success: true,
        user: {
          id: guildWarUser.id,
          name: guildWarUser.name,
          email: guildWarUser.email,
          avatar: guildWarUser.avatar,
          role: guildWarUser.role,
          guildTeamId: guildWarUser.guildTeamId,
          guildForceId: guildWarUser.guildForceId || null
        }
      });
    }

    // Find user by email
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    // Compare password with stored hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    setSessionUser(req, {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      role: 'admin',
      guildTeamId: null,
      is_admin: user.is_admin || 0
    });

    res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, role: 'admin', is_admin: user.is_admin || 0 }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// ── LOGOUT ────────────────────────────────────────────────
// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed.' });
    res.clearCookie('auction_sid');
    res.json({ success: true });
  });
});

// ── GET CURRENT USER ──────────────────────────────────────
// GET /api/auth/me
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  
  try {
    let isAdmin = 0;
    
    // Only query DB if it's a numeric ID (regular user)
    if (typeof req.session.userId === 'number' || (typeof req.session.userId === 'string' && !isNaN(Number(req.session.userId)))) {
      const [users] = await db.query('SELECT is_admin FROM users WHERE id = ?', [req.session.userId]);
      isAdmin = users.length > 0 ? users[0].is_admin : 0;
    } else {
      // Hardcoded guild war users
      isAdmin = req.session.userRole === 'admin' ? 1 : 0;
    }
    
    res.json({
      id: req.session.userId,
      name: req.session.userName,
      avatar: req.session.userAvatar,
      role: req.session.userRole || 'admin',
      is_admin: isAdmin,
      guildTeamId: req.session.guildTeamId || null,
      guildForceId: req.session.guildForceId || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
