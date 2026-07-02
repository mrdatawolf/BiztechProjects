'use strict';
const jwt = require('jsonwebtoken');
const { db } = require('../db');

async function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.query('SELECT id, email, name FROM users WHERE id = $1', [payload.id]);
    if (!result.rows.length) {
      return res.status(401).json({ error: 'User no longer exists — please log in again' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
}

module.exports = { requireAuth };
