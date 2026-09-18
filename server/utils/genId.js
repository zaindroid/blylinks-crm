const crypto = require('crypto');

// Date.now() alone can collide under concurrent requests landing in the same
// millisecond (two rapid double-clicks, two admins acting at once, etc.) since
// none of these tables have a serial/uuid default -- the app picks its own ids.
// A short random suffix makes that collision practically impossible.
function genId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

// genId above is fine for one row per request, but its 24 random bits are shared by everything created in the
// same millisecond -- minting thousands at once (a bulk import) collides almost by birthday-paradox and fails the
// whole request on a duplicate primary key. Anything that creates many rows in one go must use this instead.
function genUniqueId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = genId;
module.exports.genUniqueId = genUniqueId;
