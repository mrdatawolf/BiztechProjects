'use strict';
const crypto = require('crypto');

function tokenDigest(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function tokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  return crypto.timingSafeEqual(tokenDigest(provided), tokenDigest(expected));
}

function requireIntegrationAuth(req, res, next) {
  const expected = (process.env.INTEGRATION_TOKEN || '').trim();
  if (!expected) {
    return res.status(503).json({ error: 'Integration API is not configured' });
  }

  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokensMatch(provided, expected)) {
    return res.status(401).json({ error: 'Invalid integration token' });
  }

  next();
}

module.exports = { requireIntegrationAuth, tokensMatch };
