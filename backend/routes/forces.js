// routes/forces.js - Force/Guild management with logo upload
const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── MULTER SETUP FOR LOGO UPLOADS ────────────────────────
const uploadDir = path.join(__dirname, '../uploads/forces');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// ── MIDDLEWARE: Check if user is admin ──────────────────────
const requireAdmin = (req, res, next) => {
  if (!res.locals.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const role = res.locals.userRole;
  if (role !== 'admin' && role !== 'guild_leader') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ── CREATE FORCE (Admin only) ────────────────────────────────
// POST /api/forces
router.post('/', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    const { name, description } = req.body;
    const adminId = req.session.userId;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Force name is required' });
    }

    let logoUrl = '';
    if (req.file) {
      // Store relative path for serving
      logoUrl = `/uploads/forces/${req.file.filename}`;
    }

    const [result] = await db.query(
      'INSERT INTO forces (name, description, logo_url, admin_id) VALUES (?, ?, ?, ?)',
      [name.trim(), description || '', logoUrl, adminId]
    );

    res.json({
      id: result.insertId,
      name,
      description: description || '',
      logo_url: logoUrl,
      admin_id: adminId
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Force name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE FORCE LOGO (Admin only) ───────────────────────────
// PUT /api/forces/:id/logo
router.put('/:id/logo', requireAuth, requireAdmin, upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No logo file provided' });
    }

    // Get current force
    const [force] = await db.query('SELECT * FROM forces WHERE id = ?', [id]);
    if (!force) {
      return res.status(404).json({ error: 'Force not found' });
    }

    // Delete old logo if it exists
    if (force.logo_url && force.logo_url.startsWith('/uploads/forces/')) {
      const oldFilePath = path.join(__dirname, '../' + force.logo_url);
      fs.unlink(oldFilePath, (err) => {
        if (err) console.log('Old logo deletion warning:', err.message);
      });
    }

    const logoUrl = `/uploads/forces/${req.file.filename}`;

    await db.query('UPDATE forces SET logo_url = ? WHERE id = ?', [logoUrl, id]);

    res.json({
      id,
      logo_url: logoUrl,
      message: 'Force logo updated successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE FORCE (Admin only) ────────────────────────────────
// PUT /api/forces/:id
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const [force] = await db.query('SELECT * FROM forces WHERE id = ?', [id]);
    if (!force) {
      return res.status(404).json({ error: 'Force not found' });
    }

    const updateName = name !== undefined ? name : force.name;
    const updateDesc = description !== undefined ? description : force.description;

    await db.query(
      'UPDATE forces SET name = ?, description = ? WHERE id = ?',
      [updateName, updateDesc, id]
    );

    res.json({
      id,
      name: updateName,
      description: updateDesc,
      logo_url: force.logo_url,
      message: 'Force updated successfully'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Force name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ── GET ALL FORCES ───────────────────────────────────────────
// GET /api/forces
router.get('/', async (req, res) => {
  try {
    const [forces] = await db.query(
      'SELECT id, name, description, logo_url, admin_id, created_at FROM forces ORDER BY created_at DESC'
    );
    res.json(forces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET FORCE BY ID ──────────────────────────────────────────
// GET /api/forces/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [force] = await db.query(
      'SELECT * FROM forces WHERE id = ?',
      [id]
    );

    if (!force) {
      return res.status(404).json({ error: 'Force not found' });
    }

    res.json(force);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE FORCE (Admin only) ────────────────────────────────
// DELETE /api/forces/:id
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const [force] = await db.query('SELECT * FROM forces WHERE id = ?', [id]);
    if (!force) {
      return res.status(404).json({ error: 'Force not found' });
    }

    // Delete logo file
    if (force.logo_url && force.logo_url.startsWith('/uploads/forces/')) {
      const filePath = path.join(__dirname, '../' + force.logo_url);
      fs.unlink(filePath, (err) => {
        if (err) console.log('Logo deletion warning:', err.message);
      });
    }

    await db.query('DELETE FROM forces WHERE id = ?', [id]);

    res.json({ message: 'Force deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
