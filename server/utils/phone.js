// Phone numbers arrive in every format imaginable: 03001234567, +92 300 1234567, 0092-300-1234567,
// (555) 123-4567, +1 555 123 4567. For Do-Not-Call matching, formatting and country-code prefixes must
// not let a listed number slip through, so numbers are compared by their last 10 digits.
// (Matching more loosely than exactly is the safe direction for a DNC check: a false "on the list"
// costs a skipped call; a false "not on the list" costs a compliance breach.)

const MIN_DIGITS = 7;
const MAX_DIGITS = 15; // E.164 maximum

// Returns the matching key, or null if the input is not plausibly a phone number.
function phoneKey(raw) {
  if (raw === undefined || raw === null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  // Anything that is one repeated digit (0000000, 1111111...) is a placeholder, not a number.
  if (/^(\d)\1+$/.test(digits)) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

module.exports = { phoneKey };
