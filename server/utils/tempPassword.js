const crypto = require('crypto');

// Readable-but-random temp password for an admin/supervisor-mediated reset:
// no ambiguous characters (0/O, 1/l/I) since it's often relayed verbally or
// typed by hand from a screen, comfortably longer than the 8-char minimum,
// and drawn from crypto.randomInt (not Math.random) since this briefly
// stands in as a real credential.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateTempPassword(length = 12) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return out;
}

module.exports = { generateTempPassword };
