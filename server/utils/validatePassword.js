const MIN_LENGTH = 8;

function passwordError(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  return null;
}

module.exports = { passwordError, MIN_LENGTH };
