/**
 * Safe SQL identifier quoting utility.
 * Prevents SQL injection through identifier names.
 */

// Allowed pattern for identifiers: letters, digits, underscores
const SAFE_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Maximum identifier length (PostgreSQL limit is 63)
const MAX_IDENTIFIER_LENGTH = 63;

/**
 * Quote a SQL identifier safely.
 * Only allows simple alphanumeric + underscore identifiers.
 *
 * @param {string} identifier - The identifier to quote
 * @returns {string} The safely quoted identifier
 * @throws Error if the identifier contains unsafe characters
 */
function quoteIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Identifier is required and must be a string.');
  }

  if (identifier.length > MAX_IDENTIFIER_LENGTH) {
    throw new Error(`Identifier exceeds maximum length of ${MAX_IDENTIFIER_LENGTH}.`);
  }

  if (!SAFE_IDENTIFIER_PATTERN.test(identifier)) {
    throw new Error(`Identifier "${identifier}" contains unsafe characters.`);
  }

  // Double-quote the identifier (PostgreSQL standard)
  return `"${identifier}"`;
}

/**
 * Validate that a name follows the demo index naming pattern.
 */
function isValidIndexName(name) {
  return /^idx_[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

module.exports = { quoteIdentifier, isValidIndexName, SAFE_IDENTIFIER_PATTERN };
