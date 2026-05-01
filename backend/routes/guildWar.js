const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/guild-war/state
router.get('/state', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT state_json FROM guild_war_settings WHERE id = 1');
    if (rows.length === 0) {
      return res.json({ state: null });
    }
    res.json({ state: JSON.parse(rows[0].state_json) });
  } catch (err) {
    console.error('Error fetching guild war state:', err);
    res.status(500).json({ error: 'Failed to fetch state' });
  }
});

// POST /api/guild-war/state
router.post('/state', requireAuth, async (req, res) => {
  try {
    const userId = res.locals.userId;
    const userRole = res.locals.userRole;
    console.log(`[GuildWar] State update attempt by ${userRole} (ID: ${userId})`);

    const stateJson = JSON.stringify(req.body);
    
    // Use INSERT ... ON DUPLICATE KEY UPDATE to ensure we only have one row
    await db.query(
      'INSERT INTO guild_war_settings (id, state_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE state_json = ?',
      [stateJson, stateJson]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving guild war state:', err);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

module.exports = router;
