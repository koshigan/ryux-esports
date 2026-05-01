// routes/auth.js - User authentication endpoints (JWT-based)
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { validateRegister } = require('../middleware/validate');
const { setAuthCookie, clearAuthCookie } = require('../middleware/auth');

const router = express.Router();

const guildWarAccounts = [
  { id: 'gw-admin',          name: 'RYUX Admin',          email: 'admin@ryuxesports.com',        password: 'Admin@123',        avatar: 'A', role: 'admin',         guildTeamId: null, guildForceId: null },
  { id: 'gw-guild-leader',   name: 'Guild Leader',        email: 'guildleader@ryuxesports.com',  password: 'GuildLeader@123',  avatar: 'G', role: 'guild_leader',  guildTeamId: null, guildForceId: 'sukuna' },
  { id: 'gw-acting-leader',  name: 'Acting Guild Leader', email: 'acting@ryuxesports.com',       password: 'Acting@123',       avatar: 'A', role: 'force_captain', guildTeamId: null, guildForceId: 'alien' },
  { id: 'gw-supreme-leader', name: 'Supreme Leader',      email: 'supreme@ryuxesports.com',      password: 'Supreme@123',      avatar: 'S', role: 'force_captain', guildTeamId: null, guildForceId: 'das' },
  { id: 'gw-team-1',         name: 'Black Bulls Leader',  email: 'blackbulls@ryuxesports.com',   password: 'BlackBulls@123',   avatar: 'B', role: 'war_leader',    guildTeamId: 1,    guildForceId: null },
  { id: 'gw-team-2',         name: 'Red Reapers Leader',  email: 'redreapers@ryuxesports.com',   password: 'RedReapers@123',   avatar: 'R', role: 'war_leader',    guildTeamId: 2,    guildForceId: null },
  { id: 'gw-team-3',         name: 'Storm Hunters Leader',email: 'stormhunters@ryuxesports.com', password: 'StormHunters@123', avatar: 'S', role: 'war_leader',    guildTeamId: 3,    guildForceId: null }
];

// ── REGISTER ──────────────────────────────────────────────
// POST /api/auth/register
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const avatars = ['🧑', '👩', '🦸', '🧙', '🤴', '👸', '🦊', '🐯', '🦁', '🐲'];
    const avatar = avatars[Math.floor(Math.random() * avatars.length)];

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, avatar]
    );

    setAuthCookie(res, {
      userId: result.insertId,
      userName: name,
      userAvatar: avatar,
      userRole: 'admin',
      guildTeamId: null,
      guildForceId: null
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
    const email    = (req.body.email    || '').toLowerCase().trim();
    const password =  req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Check hardcoded guild war accounts first
    const guildWarUser = guildWarAccounts.find((a) => a.email === email);
    if (guildWarUser) {
      if (guildWarUser.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      setAuthCookie(res, {
        userId:       guildWarUser.id,
        userName:     guildWarUser.name,
        userAvatar:   guildWarUser.avatar,
        userRole:     guildWarUser.role,
        guildTeamId:  guildWarUser.guildTeamId,
        guildForceId: guildWarUser.guildForceId
      });

      return res.json({
        success: true,
        user: {
          id:           guildWarUser.id,
          name:         guildWarUser.name,
          email:        guildWarUser.email,
          avatar:       guildWarUser.avatar,
          role:         guildWarUser.role,
          guildTeamId:  guildWarUser.guildTeamId,
          guildForceId: guildWarUser.guildForceId || null
        }
      });
    }

    // Regular DB user
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    setAuthCookie(res, {
      userId:       user.id,
      userName:     user.name,
      userAvatar:   user.avatar,
      userRole:     'admin',
      guildTeamId:  null,
      guildForceId: null
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
  clearAuthCookie(res);
  res.json({ success: true });
});

// ── GET CURRENT USER ──────────────────────────────────────
// GET /api/auth/me
router.get('/me', async (req, res) => {
  if (!res.locals.userId) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  try {
    let isAdmin = 0;
    const uid = res.locals.userId;

    // Only query DB for numeric (regular) user IDs
    if (!isNaN(Number(uid)) && String(uid) === String(Number(uid))) {
      const [users] = await db.query('SELECT is_admin FROM users WHERE id = ?', [uid]);
      isAdmin = users.length > 0 ? users[0].is_admin : 0;
    } else {
      isAdmin = res.locals.userRole === 'admin' ? 1 : 0;
    }

    res.json({
      id:           res.locals.userId,
      name:         res.locals.userName,
      avatar:       res.locals.userAvatar || res.locals.userName?.[0] || 'R',
      role:         res.locals.userRole || 'admin',
      is_admin:     isAdmin,
      guildTeamId:  res.locals.guildTeamId  || null,
      guildForceId: res.locals.guildForceId || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
