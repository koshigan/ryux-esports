// routes/players.js - Add, edit, delete, upload players
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sanitize } = require('../middleware/validate');

const router = express.Router();

// Multer config: memory storage for CSV parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'));
    }
  }
});

// Helper: verify host access for a room
async function verifyHost(roomId, userId) {
  const [rows] = await db.query(
    'SELECT host_id FROM rooms WHERE id = ?', [roomId]
  );
  return rows.length > 0 && rows[0].host_id === userId;
}

// ── ADD SINGLE PLAYER ─────────────────────────────────────
// POST /api/players/add
router.post('/add', requireAuth, async (req, res) => {
  try {
    const { room_id, name, category, base_price, image_url } = req.body;
    const userId = res.locals.userId;

    if (!await verifyHost(room_id, userId)) {
      return res.status(403).json({ error: 'Only the host can add players.' });
    }

    if (!name || sanitize(name).length < 1) {
      return res.status(400).json({ error: 'Player name is required.' });
    }

    const price = parseInt(base_price) || 10;
    if (price < 1) return res.status(400).json({ error: 'Base price must be at least 1.' });

    // Get current max order for this room
    const [maxOrder] = await db.query(
      'SELECT MAX(auction_order) as maxOrd FROM players WHERE room_id = ?', [room_id]
    );
    const nextOrder = (maxOrder[0].maxOrd || 0) + 1;

    const [result] = await db.query(
      `INSERT INTO players (room_id, name, category, base_price, image_url, auction_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [room_id, sanitize(name), sanitize(category || 'General'), price, sanitize(image_url || ''), nextOrder]
    );

    res.json({ success: true, playerId: result.insertId });
  } catch (err) {
    console.error('Add player error:', err);
    res.status(500).json({ error: 'Failed to add player.' });
  }
});

// ── UPLOAD PLAYERS VIA CSV ────────────────────────────────
// POST /api/players/upload-csv
// Expected CSV columns: name, category, base_price, image_url
router.post('/upload-csv', requireAuth, upload.single('csv'), async (req, res) => {
  try {
    const { room_id } = req.body;
    const userId = res.locals.userId;

    if (!await verifyHost(room_id, userId)) {
      return res.status(403).json({ error: 'Only the host can upload players.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded.' });
    }

    // Parse CSV from buffer
    const records = parse(req.file.buffer, {
      columns: true,        // first row = headers
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty.' });
    }

    // Get current max order
    const [maxOrder] = await db.query(
      'SELECT MAX(auction_order) as maxOrd FROM players WHERE room_id = ?', [room_id]
    );
    let nextOrder = (maxOrder[0].maxOrd || 0) + 1;

    let added = 0;
    const errors = [];

    for (const record of records) {
      const name = sanitize(record.name || '');
      if (!name) {
        errors.push(`Skipped row: missing name`);
        continue;
      }

      const category = sanitize(record.category || 'General');
      const base_price = parseInt(record.base_price) || 10;
      const image_url = sanitize(record.image_url || '');

      await db.query(
        `INSERT INTO players (room_id, name, category, base_price, image_url, auction_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [room_id, name, category, base_price, image_url, nextOrder++]
      );
      added++;
    }

    res.json({ success: true, added, errors });
  } catch (err) {
    console.error('CSV upload error:', err);
    res.status(500).json({ error: 'Failed to process CSV file.' });
  }
});

// ── EDIT PLAYER ───────────────────────────────────────────
// PUT /api/players/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const playerId = req.params.id;
    const userId = res.locals.userId;
    const { name, category, base_price, image_url } = req.body;

    // Get player's room to verify host
    const [players] = await db.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) return res.status(404).json({ error: 'Player not found.' });

    const player = players[0];
    if (player.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot edit a player after auction has started.' });
    }

    if (!await verifyHost(player.room_id, userId)) {
      return res.status(403).json({ error: 'Only the host can edit players.' });
    }

    await db.query(
      `UPDATE players SET name = ?, category = ?, base_price = ?, image_url = ?
       WHERE id = ?`,
      [
        sanitize(name || player.name),
        sanitize(category || player.category),
        parseInt(base_price) || player.base_price,
        sanitize(image_url !== undefined ? image_url : player.image_url),
        playerId
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Edit player error:', err);
    res.status(500).json({ error: 'Failed to update player.' });
  }
});

// ── DELETE PLAYER ─────────────────────────────────────────
// DELETE /api/players/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const playerId = req.params.id;
    const userId = res.locals.userId;

    const [players] = await db.query('SELECT * FROM players WHERE id = ?', [playerId]);
    if (players.length === 0) return res.status(404).json({ error: 'Player not found.' });

    const player = players[0];
    if (player.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot delete a player after auction has started.' });
    }

    if (!await verifyHost(player.room_id, userId)) {
      return res.status(403).json({ error: 'Only the host can delete players.' });
    }

    await db.query('DELETE FROM players WHERE id = ?', [playerId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete player error:', err);
    res.status(500).json({ error: 'Failed to delete player.' });
  }
});

// ── GET PLAYERS FOR ROOM ──────────────────────────────────
// GET /api/players/room/:roomId
router.get('/room/:roomId', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const [players] = await db.query(
      `SELECT p.*, u.name as sold_to_name
       FROM players p
       LEFT JOIN users u ON p.sold_to = u.id
       WHERE p.room_id = ?
       ORDER BY p.auction_order ASC, p.id ASC`,
      [roomId]
    );
    res.json(players);
  } catch (err) {
    console.error('Get players error:', err);
    res.status(500).json({ error: 'Failed to fetch players.' });
  }
});

// ── GET TEAM (players bought by user in room) ─────────────
// GET /api/players/team/:roomId/:userId
router.get('/team/:roomId/:userId', requireAuth, async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const [team] = await db.query(
      `SELECT p.*, t.price_paid, t.purchased_at
       FROM teams t
       JOIN players p ON t.player_id = p.id
       WHERE t.room_id = ? AND t.user_id = ?`,
      [roomId, userId]
    );
    res.json(team);
  } catch (err) {
    console.error('Get team error:', err);
    res.status(500).json({ error: 'Failed to fetch team.' });
  }
});

module.exports = router;
