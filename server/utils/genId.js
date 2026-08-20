const crypto = require('crypto');

// Date.now() alone can collide under concurrent requests landing in the same
// millisecond (two rapid double-clicks, two admins acting at once, etc.) since
// none of these tables have a serial/uuid default -- the app picks its own ids.
// A short random suffix makes that collision practically impossible.
function genId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

module.exports = genId;
