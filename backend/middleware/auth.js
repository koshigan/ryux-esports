// middleware/auth.js - JWT-based authentication middleware
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ryux-jwt-secret-2024';
const COOKIE_NAME = 'auction_token';
const IS_PROD = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

/**
 * Signs a JWT and sets it as an httpOnly cookie on the response.
 */
function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

/**
 * Clears the auth cookie (logout).
 */
function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'none' : 'lax'
  });
}

/**
 * Reads and verifies the JWT cookie. Populates res.locals with user info.
 * Called on every request.
 */
function attachUser(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.locals.userId   = decoded.userId;
      res.locals.userName = decoded.userName;
      res.locals.userRole = decoded.userRole || 'admin';
      res.locals.guildTeamId  = decoded.guildTeamId  || null;
      res.locals.guildForceId = decoded.guildForceId || null;
    }
  } catch {
    // Invalid / expired token — treat as unauthenticated
  }
  next();
}

/**
 * Protects routes — returns 401 JSON for API or redirects to /login for pages.
 */
function requireAuth(req, res, next) {
  if (res.locals.userId) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  res.redirect('/login');
}

module.exports = { requireAuth, attachUser, setAuthCookie, clearAuthCookie };
