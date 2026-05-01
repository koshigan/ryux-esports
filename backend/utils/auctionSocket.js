// utils/auctionSocket.js - Real-time auction engine via Socket.io
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { validateBid } = require('../middleware/validate');

const JWT_SECRET = process.env.JWT_SECRET || 'ryux-jwt-secret-2024';

/**
 * In-memory auction state per room (cleared when server restarts)
 * auctionState[roomId] = {
 *   currentPlayerId, currentBid, highestBidderId, highestBidderName,
 *   timerSeconds, timerInterval, status, isPaused
 * }
 */
const auctionState = {};

module.exports = function setupAuctionSocket(io) {

  // Socket.io JWT middleware - read token from cookie
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.request.headers.cookie || '';
      const match = cookieHeader.match(/auction_token=([^;]+)/);
      if (!match) return next(new Error('Unauthorized'));

      const decoded = jwt.verify(match[1], JWT_SECRET);
      socket.userId       = decoded.userId;
      socket.userName     = decoded.userName;
      socket.userAvatar   = decoded.userAvatar;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: user ${socket.userId} (${socket.userName})`);

    // ── JOIN ROOM ──────────────────────────────────────────
    socket.on('join_room', async ({ roomId }) => {
      try {
        // Verify user is a participant
        const [rows] = await db.query(
          'SELECT * FROM room_participants WHERE room_id = ? AND user_id = ?',
          [roomId, socket.userId]
        );
        if (rows.length === 0) {
          socket.emit('error', { message: 'You are not a participant in this room.' });
          return;
        }

        socket.join(`room_${roomId}`);
        socket.roomId = roomId;

        // Notify room that user joined
        io.to(`room_${roomId}`).emit('user_joined', {
          userId: socket.userId,
          userName: socket.userName,
          avatar: socket.userAvatar
        });

        // Send current auction state if active
        if (auctionState[roomId]) {
          socket.emit('auction_state', auctionState[roomId]);
        }

        console.log(`👥 User ${socket.userName} joined room ${roomId}`);
      } catch (err) {
        console.error('join_room error:', err);
        socket.emit('error', { message: 'Failed to join room.' });
      }
    });

    // ── START AUCTION (host only) ──────────────────────────
    socket.on('start_auction', async ({ roomId }) => {
      try {
        const room = await getRoom(roomId);
        if (!room || room.host_id !== socket.userId) {
          return socket.emit('error', { message: 'Only the host can start the auction.' });
        }

        // Update room status to active
        await db.query('UPDATE rooms SET status = ? WHERE id = ?', ['active', roomId]);

        // Get first pending player
        const player = await getNextPlayer(roomId);
        if (!player) {
          socket.emit('error', { message: 'No players to auction. Add players first.' });
          return;
        }

        await startPlayerAuction(io, socket, roomId, player, room.bid_timer);
      } catch (err) {
        console.error('start_auction error:', err);
        socket.emit('error', { message: 'Failed to start auction.' });
      }
    });

    // ── PLACE BID ─────────────────────────────────────────
    socket.on('place_bid', async ({ roomId, amount }) => {
      try {
        const state = auctionState[roomId];
        if (!state || state.status !== 'bidding') {
          return socket.emit('error', { message: 'No active auction right now.' });
        }

        const bidAmount = parseInt(amount);

        // Validate bid amount
        const bidError = validateBid(bidAmount, state.currentBid);
        if (bidError) {
          return socket.emit('error', { message: bidError });
        }

        // Check user's remaining budget
        const [participant] = await db.query(
          'SELECT budget_remaining FROM room_participants WHERE room_id = ? AND user_id = ?',
          [roomId, socket.userId]
        );
        if (participant.length === 0 || participant[0].budget_remaining < bidAmount) {
          return socket.emit('error', { message: 'Insufficient budget for this bid.' });
        }

        // Prevent bidding on own sold player or same amount
        if (state.highestBidderId === socket.userId && bidAmount === state.currentBid) {
          return socket.emit('error', { message: 'You are already the highest bidder.' });
        }

        // Save bid to database
        await db.query(
          'INSERT INTO bids (player_id, room_id, user_id, amount) VALUES (?, ?, ?, ?)',
          [state.currentPlayerId, roomId, socket.userId, bidAmount]
        );

        // Update state
        state.currentBid = bidAmount;
        state.highestBidderId = socket.userId;
        state.highestBidderName = socket.userName;
        state.highestBidderAvatar = socket.userAvatar;

        // Broadcast new bid to room
        io.to(`room_${roomId}`).emit('new_bid', {
          amount: bidAmount,
          bidderId: socket.userId,
          bidderName: socket.userName,
          bidderAvatar: socket.userAvatar,
          playerId: state.currentPlayerId
        });

        // Anti-sniping: Reset timer to 10 seconds if under 10 seconds
        const room = await getRoom(roomId);
        let newTime = state.timerSeconds;
        if (state.timerSeconds < 10) {
          newTime = Math.min(10, room.bid_timer);
        }
        resetTimer(io, roomId, newTime);

        console.log(`💰 Bid: ${socket.userName} bid ${bidAmount} on player ${state.currentPlayerId}`);
      } catch (err) {
        console.error('place_bid error:', err);
        socket.emit('error', { message: 'Failed to place bid.' });
      }
    });

    // ── SKIP PLAYER (host only) ───────────────────────────
    socket.on('skip_player', async ({ roomId }) => {
      try {
        const room = await getRoom(roomId);
        if (!room || room.host_id !== socket.userId) {
          return socket.emit('error', { message: 'Only the host can skip players.' });
        }

        const state = auctionState[roomId];
        if (!state) return;

        // Clear current timer
        clearInterval(state.timerInterval);
        state.status = 'skipped';

        // Mark player as unsold
        await db.query(
          'UPDATE players SET status = ? WHERE id = ?',
          ['unsold', state.currentPlayerId]
        );

        io.to(`room_${roomId}`).emit('player_skipped', {
          playerId: state.currentPlayerId
        });

        // Move to next player
        await moveToNextPlayer(io, socket, roomId);
      } catch (err) {
        console.error('skip_player error:', err);
      }
    });

    // ── PAUSE/RESUME (host only) ───────────────────────────
    socket.on('pause_auction', async ({ roomId }) => {
      try {
        const room = await getRoom(roomId);
        if (!room || room.host_id !== socket.userId) return;

        const state = auctionState[roomId];
        if (!state) return;

        if (state.isPaused) {
          // Resume
          state.isPaused = false;
          await db.query('UPDATE rooms SET status = ? WHERE id = ?', ['active', roomId]);
          startCountdown(io, roomId);
          io.to(`room_${roomId}`).emit('auction_resumed');
        } else {
          // Pause
          state.isPaused = true;
          clearInterval(state.timerInterval);
          await db.query('UPDATE rooms SET status = ? WHERE id = ?', ['paused', roomId]);
          io.to(`room_${roomId}`).emit('auction_paused');
        }
      } catch (err) {
        console.error('pause_auction error:', err);
      }
    });

    // ── END AUCTION (host only) ───────────────────────────
    socket.on('end_auction', async ({ roomId }) => {
      try {
        const room = await getRoom(roomId);
        if (!room || room.host_id !== socket.userId) return;

        const state = auctionState[roomId];
        if (state) {
          clearInterval(state.timerInterval);
          delete auctionState[roomId];
        }

        await db.query('UPDATE rooms SET status = ? WHERE id = ?', ['ended', roomId]);
        io.to(`room_${roomId}`).emit('auction_ended');
        console.log(`🏁 Auction ended for room ${roomId}`);
      } catch (err) {
        console.error('end_auction error:', err);
      }
    });

    // ── CHAT MESSAGE ──────────────────────────────────────
    socket.on('send_message', async ({ roomId, message }) => {
      try {
        const cleanMsg = (message || '').trim().substring(0, 500);
        if (!cleanMsg) return;

        await db.query(
          'INSERT INTO chat_messages (room_id, user_id, message) VALUES (?, ?, ?)',
          [roomId, socket.userId, cleanMsg]
        );

        io.to(`room_${roomId}`).emit('chat_message', {
          userId: socket.userId,
          userName: socket.userName,
          avatar: socket.userAvatar,
          message: cleanMsg,
          sent_at: new Date()
        });
      } catch (err) {
        console.error('chat error:', err);
      }
    });

    // ── DISCONNECT ────────────────────────────────────────
    socket.on('disconnect', () => {
      if (socket.roomId) {
        io.to(`room_${socket.roomId}`).emit('user_left', {
          userId: socket.userId,
          userName: socket.userName
        });
      }
      console.log(`🔌 Socket disconnected: ${socket.userName}`);
    });
  });

  // ══════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ══════════════════════════════════════════════════════

  /** Fetch room by ID */
  async function getRoom(roomId) {
    const [rows] = await db.query('SELECT * FROM rooms WHERE id = ?', [roomId]);
    return rows[0] || null;
  }

  /** Fetch next pending player for auction */
  async function getNextPlayer(roomId) {
    const [rows] = await db.query(
      `SELECT * FROM players
       WHERE room_id = ? AND status = 'pending'
       ORDER BY auction_order ASC, id ASC
       LIMIT 1`,
      [roomId]
    );
    return rows[0] || null;
  }

  /** Initialize auction state for a player and broadcast */
  async function startPlayerAuction(io, socket, roomId, player, bidTimer) {
    // Initialize state
    auctionState[roomId] = {
      currentPlayerId: player.id,
      currentPlayerName: player.name,
      currentPlayerCategory: player.category,
      currentPlayerImage: player.image_url,
      currentBid: player.base_price,
      basePrice: player.base_price,
      highestBidderId: null,
      highestBidderName: null,
      highestBidderAvatar: null,
      timerSeconds: bidTimer,
      timerInterval: null,
      status: 'bidding',
      isPaused: false
    };

    // Mark player as active
    await db.query('UPDATE players SET status = ? WHERE id = ?', ['active', player.id]);

    // Broadcast new player up for auction
    io.to(`room_${roomId}`).emit('player_up', {
      player: {
        id: player.id,
        name: player.name,
        category: player.category,
        image_url: player.image_url,
        base_price: player.base_price
      },
      timerSeconds: bidTimer
    });

    // Start countdown
    startCountdown(io, roomId);
    console.log(`🎯 Auction started for player: ${player.name} (room ${roomId})`);
  }

  /** Start/restart the countdown timer */
  function startCountdown(io, roomId) {
    const state = auctionState[roomId];
    if (!state) return;

    clearInterval(state.timerInterval);

    state.timerInterval = setInterval(async () => {
      if (state.isPaused) return;

      state.timerSeconds--;
      io.to(`room_${roomId}`).emit('timer_tick', { seconds: state.timerSeconds });

      if (state.timerSeconds <= 0) {
        clearInterval(state.timerInterval);
        await handleTimerExpiry(io, roomId);
      }
    }, 1000);
  }

  /** Reset timer to new value */
  function resetTimer(io, roomId, newSeconds) {
    const state = auctionState[roomId];
    if (!state) return;
    state.timerSeconds = newSeconds;
    clearInterval(state.timerInterval);
    startCountdown(io, roomId);
  }

  /** Handle timer expiry - sell or mark unsold */
  async function handleTimerExpiry(io, roomId) {
    const state = auctionState[roomId];
    if (!state) return;

    if (state.highestBidderId) {
      // SOLD! Record transaction
      await db.query(
        `UPDATE players SET status = 'sold', sold_to = ?, sold_price = ? WHERE id = ?`,
        [state.highestBidderId, state.currentBid, state.currentPlayerId]
      );

      // Deduct budget from winner
      await db.query(
        'UPDATE room_participants SET budget_remaining = budget_remaining - ? WHERE room_id = ? AND user_id = ?',
        [state.currentBid, roomId, state.highestBidderId]
      );

      // Add to winner's team
      await db.query(
        'INSERT INTO teams (room_id, user_id, player_id, price_paid) VALUES (?, ?, ?, ?)',
        [roomId, state.highestBidderId, state.currentPlayerId, state.currentBid]
      );

      io.to(`room_${roomId}`).emit('player_sold', {
        playerId: state.currentPlayerId,
        playerName: state.currentPlayerName,
        soldTo: state.highestBidderId,
        soldToName: state.highestBidderName,
        soldToAvatar: state.highestBidderAvatar,
        price: state.currentBid
      });

      console.log(`✅ SOLD: ${state.currentPlayerName} → ${state.highestBidderName} for ${state.currentBid}`);
    } else {
      // No bids - mark unsold
      await db.query('UPDATE players SET status = ? WHERE id = ?', ['unsold', state.currentPlayerId]);
      io.to(`room_${roomId}`).emit('player_unsold', { playerId: state.currentPlayerId });
      console.log(`❌ UNSOLD: ${state.currentPlayerName}`);
    }

    // Small delay then move to next player
    setTimeout(() => moveToNextPlayer(io, null, roomId), 3000);
  }

  /** Move to next pending player or end auction */
  async function moveToNextPlayer(io, socket, roomId) {
    const room = await getRoom(roomId);
    if (!room) return;

    const nextPlayer = await getNextPlayer(roomId);

    if (nextPlayer) {
      await startPlayerAuction(io, socket, roomId, nextPlayer, room.bid_timer);
    } else {
      // All players done - end auction
      delete auctionState[roomId];
      await db.query('UPDATE rooms SET status = ? WHERE id = ?', ['ended', roomId]);
      io.to(`room_${roomId}`).emit('auction_ended');
      console.log(`🏁 All players auctioned! Room ${roomId} ended.`);
    }
  }
};
