// routes/auction.js - Bid history, leaderboard, auction stats
const express = require('express');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── BID HISTORY FOR A PLAYER ──────────────────────────────
// GET /api/auction/bids/:playerId
router.get('/bids/:playerId', requireAuth, async (req, res) => {
  try {
    const [bids] = await db.query(
      `SELECT b.*, u.name as bidder_name, u.avatar as bidder_avatar
       FROM bids b
       JOIN users u ON b.user_id = u.id
       WHERE b.player_id = ?
       ORDER BY b.bid_time DESC
       LIMIT 20`,
      [req.params.playerId]
    );
    res.json(bids);
  } catch (err) {
    console.error('Bid history error:', err);
    res.status(500).json({ error: 'Failed to fetch bid history.' });
  }
});

// ── LEADERBOARD FOR A ROOM ────────────────────────────────
// GET /api/auction/leaderboard/:roomId
router.get('/leaderboard/:roomId', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const [leaderboard] = await db.query(
      `SELECT
         u.id,
         u.name,
         u.avatar,
         rp.budget_remaining,
         r.budget_per_user as starting_budget,
         (r.budget_per_user - rp.budget_remaining) as total_spent,
         COUNT(t.id) as players_bought,
         COALESCE(SUM(t.price_paid), 0) as actual_spent
       FROM room_participants rp
       JOIN users u ON rp.user_id = u.id
       JOIN rooms r ON rp.room_id = r.id
       LEFT JOIN teams t ON t.room_id = ? AND t.user_id = u.id
       WHERE rp.room_id = ?
       GROUP BY u.id, u.name, u.avatar, rp.budget_remaining, r.budget_per_user
       ORDER BY players_bought DESC, actual_spent DESC`,
      [roomId, roomId]
    );

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

// ── AUCTION HISTORY (ended rooms summary) ─────────────────
// GET /api/auction/history
router.get('/history', requireAuth, async (req, res) => {
  try {
    const userId = res.locals.userId;
    const [history] = await db.query(
      `SELECT r.id, r.name, r.room_code, r.status, r.created_at,
              COUNT(DISTINCT t.player_id) as players_bought,
              COALESCE(SUM(t.price_paid), 0) as total_spent,
              rp.budget_remaining
       FROM room_participants rp
       JOIN rooms r ON rp.room_id = r.id
       LEFT JOIN teams t ON t.room_id = r.id AND t.user_id = ?
       WHERE rp.user_id = ?
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [userId, userId]
    );
    res.json(history);
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Failed to fetch auction history.' });
  }
});

// ── CHAT MESSAGES FOR A ROOM ─────────────────────────────
// GET /api/auction/chat/:roomId
router.get('/chat/:roomId', requireAuth, async (req, res) => {
  try {
    const [messages] = await db.query(
      `SELECT c.*, u.name, u.avatar
       FROM chat_messages c
       JOIN users u ON c.user_id = u.id
       WHERE c.room_id = ?
       ORDER BY c.sent_at ASC
       LIMIT 100`,
      [req.params.roomId]
    );
    res.json(messages);
  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ error: 'Failed to fetch chat.' });
  }
});

module.exports = router;
