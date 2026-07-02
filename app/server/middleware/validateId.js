'use strict';

// Parses req.params.id into req.idParam; rejects anything that isn't a
// positive integer instead of letting parseInt('abc') -> NaN reach a query.
function validateId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  req.idParam = id;
  next();
}

module.exports = { validateId };
