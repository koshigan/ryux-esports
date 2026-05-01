// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const playerRoutes = require('./routes/players');
const auctionRoutes = require('./routes/auction');
const forcesRoutes = require('./routes/forces');
const guildWarRoutes = require('./routes/guildWar');

const { attachUser } = require('./middleware/auth');
const setupAuctionSocket = require('./utils/auctionSocket');

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
  }
});

app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(attachUser);

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, './uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/forces', forcesRoutes);
app.use('/api/guild-war', guildWarRoutes);

// Pages
const pagesDir = path.join(__dirname, '../frontend/pages');

app.get('/', (req, res) => {
  res.sendFile(path.join(pagesDir, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(pagesDir, 'dashboard.html'));
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(pagesDir, 'history.html'));
});

app.get('/room', (req, res) => {
  res.sendFile(path.join(pagesDir, 'room.html'));
});

app.get('/admin-forces', (req, res) => {
  res.sendFile(path.join(pagesDir, 'admin-forces.html'));
});

app.get('/guild-war', (req, res) => {
  res.sendFile(path.join(pagesDir, 'guild-war.html'));
});

app.get('/guild-war-force', (req, res) => {
  res.sendFile(path.join(pagesDir, 'guild-war-force.html'));
});

app.get('/guild-war/force/:forceId', (req, res) => {
  res.sendFile(path.join(pagesDir, 'guild-war-force.html'));
});

app.get('/guild-war-progress', (req, res) => {
  res.sendFile(path.join(pagesDir, 'guild-war-progress.html'));
});

app.get('/guild-war-team', (req, res) => {
  res.sendFile(path.join(pagesDir, 'guild-war-team.html'));
});

// Socket setup
setupAuctionSocket(io);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});