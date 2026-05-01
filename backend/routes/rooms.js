// routes/rooms.js - Auction room creation, joining, listing
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { sanitize } = require('../middleware/validate');

const router = express.Router();

// Helper: generate a short unique room code (e.g. "AX7K2P")
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── CREATE ROOM ───────────────────────────────────────────
// POST /api/rooms/create
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { name, is_public, budget_per_user, bid_timer } = req.body;
    const hostId = res.locals.userId;

    if (!name || sanitize(name).length < 2) {
      return res.status(400).json({ error: 'Room name must be at least 2 characters.' });
    }

    const roomCode = generateRoomCode();
    const budget = parseInt(budget_per_user) || 1000;
    const timer = parseInt(bid_timer) || 30;
    const isPublic = is_public === true || is_public === 'true' ? 1 : 0;

    const [result] = await db.query(
      `INSERT INTO rooms (name, room_code, host_id, is_public, budget_per_user, bid_timer)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sanitize(name), roomCode, hostId, isPublic, budget, timer]
    );

    const roomId = result.insertId;

    // Host automatically joins their own room
    await db.query(
      'INSERT INTO room_participants (room_id, user_id, budget_remaining) VALUES (?, ?, ?)',
      [roomId, hostId, budget]
    );

    res.json({ success: true, roomId, roomCode });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Failed to create room.' });
  }
});

// ── JOIN ROOM ─────────────────────────────────────────────
// POST /api/rooms/join
router.post('/join', requireAuth, async (req, res) => {
  try {
    const roomCode = (req.body.room_code || '').toUpperCase().trim();
    const userId = res.locals.userId;

    if (!roomCode) {
      return res.status(400).json({ error: 'Room code is required.' });
    }

    // Find room by code
    const [rooms] = await db.query('SELECT * FROM rooms WHERE room_code = ?', [roomCode]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found. Check the code.' });
    }

    const room = rooms[0];

    if (room.status === 'ended') {
      return res.status(400).json({ error: 'This auction has already ended.' });
    }

    // Check if already joined
    const [existing] = await db.query(
      'SELECT id FROM room_participants WHERE room_id = ? AND user_id = ?',
      [room.id, userId]
    );

    if (existing.length === 0) {
      // Add participant with full starting budget
      await db.query(
        'INSERT INTO room_participants (room_id, user_id, budget_remaining) VALUES (?, ?, ?)',
        [room.id, userId, room.budget_per_user]
      );
    }

    res.json({ success: true, roomId: room.id, roomCode: room.room_code });
  } catch (err) {
    console.error('Join room error:', err);
    res.status(500).json({ error: 'Failed to join room.' });
  }
});

// ── LIST PUBLIC ROOMS ─────────────────────────────────────
// GET /api/rooms/public
router.get('/public', requireAuth, async (req, res) => {
  try {
    const [rooms] = await db.query(
      `SELECT r.*, u.name as host_name, u.avatar as host_avatar,
              COUNT(rp.id) as participant_count
       FROM rooms r
       JOIN users u ON r.host_id = u.id
       LEFT JOIN room_participants rp ON r.id = rp.room_id
       WHERE r.is_public = 1 AND r.status != 'ended'
       GROUP BY r.id
       ORDER BY r.created_at DESC
       LIMIT 20`
    );
    res.json(rooms);
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch rooms.' });
  }
});

// ── MY ROOMS ─────────────────────────────────────────────
// GET /api/rooms/my
router.get('/my', requireAuth, async (req, res) => {
  try {
    const userId = res.locals.userId;
    const [rooms] = await db.query(
      `SELECT r.*, u.name as host_name, u.avatar as host_avatar,
              (SELECT COUNT(*) FROM room_participants WHERE room_id = r.id) as participant_count
       FROM rooms r
       JOIN users u ON r.host_id = u.id
       JOIN room_participants rp ON r.id = rp.room_id AND rp.user_id = ?
       ORDER BY r.created_at DESC`,
      [userId]
    );
    res.json(rooms);
  } catch (err) {
    console.error('My rooms error:', err);
    res.status(500).json({ error: 'Failed to fetch your rooms.' });
  }
});

// ── GET ROOM DETAILS ──────────────────────────────────────
// GET /api/rooms/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const roomId = req.params.id;
    const userId = res.locals.userId;

    // Get room info
    const [rooms] = await db.query(
      `SELECT r.*, u.name as host_name, u.avatar as host_avatar
       FROM rooms r JOIN users u ON r.host_id = u.id
       WHERE r.id = ?`,
      [roomId]
    );
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    const room = rooms[0];

    // Check if user is a participant
    const [participation] = await db.query(
      'SELECT * FROM room_participants WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );
    if (participation.length === 0) {
      return res.status(403).json({ error: 'You have not joined this room.' });
    }

    // Get participants list
    const [participants] = await db.query(
      `SELECT u.id, u.name, u.avatar, rp.budget_remaining,
              (SELECT COUNT(*) FROM teams WHERE room_id = ? AND user_id = u.id) as players_bought
       FROM room_participants rp
       JOIN users u ON rp.user_id = u.id
       WHERE rp.room_id = ?
       ORDER BY rp.joined_at ASC`,
      [roomId, roomId]
    );

    // Get players list
    const [players] = await db.query(
      `SELECT p.*, u.name as sold_to_name
       FROM players p
       LEFT JOIN users u ON p.sold_to = u.id
       WHERE p.room_id = ?
       ORDER BY p.auction_order ASC, p.id ASC`,
      [roomId]
    );

    res.json({
      room,
      participants,
      players,
      myBudget: participation[0].budget_remaining,
      isHost: room.host_id === userId
    });
  } catch (err) {
    console.error('Get room error:', err);
    res.status(500).json({ error: 'Failed to fetch room details.' });
  }
});

// ── UPDATE ROOM STATUS (host only) ───────────────────────
// PATCH /api/rooms/:id/status
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const roomId = req.params.id;
    const userId = res.locals.userId;

    const validStatuses = ['waiting', 'active', 'paused', 'ended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    // Only host can change status
    const [rooms] = await db.query(
      'SELECT host_id FROM rooms WHERE id = ?', [roomId]
    );
    if (rooms.length === 0 || rooms[0].host_id !== userId) {
      return res.status(403).json({ error: 'Only the host can change room status.' });
    }

    await db.query('UPDATE rooms SET status = ? WHERE id = ?', [status, roomId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

module.exports = router;
