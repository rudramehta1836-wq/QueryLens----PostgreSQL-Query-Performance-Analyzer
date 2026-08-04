/**
 * Controlled index manager for before-vs-after testing.
 * Creates and drops demo indexes using the admin pool.
 * Never accepts arbitrary SQL from the client.
 */

const { getAdminPool } = require('../config/database');
const { quoteIdentifier, isValidIndexName } = require('../utils/identifiers');
const { createError } = require('../middleware/errorHandler');

// In-memory store of active demo indexes (server-generated)
const activeDemoIndexes = new Map();

// Allowed tables for demo indexes
const ALLOWED_TABLES = new Set([
  'customers', 'orders', 'order_items'
]);

// Disallowed schemas
const DISALLOWED_SCHEMAS = new Set([
  'pg_catalog', 'information_schema', 'pg_toast'
]);

/**
 * Store a recommendation server-side for later use.
 * Returns a server-side ID that the client can reference.
 */
function storeRecommendation(recommendation) {
  const id = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  activeDemoIndexes.set(id, {
    ...recommendation,
    serverId: id,
    created: false
  });
  return id;
}

/**
 * Get a stored recommendation by ID.
 */
function getStoredRecommendation(serverId) {
  return activeDemoIndexes.get(serverId) || null;
}

/**
 * Create a demo index for before-vs-after testing.
 *
 * @param {string} serverId - Server-side recommendation ID
 * @returns {Promise<Object>} Result of index creation
 */
async function createDemoIndex(serverId) {
  const rec = activeDemoIndexes.get(serverId);
  if (!rec) {
    throw createError('Recommendation not found or expired.', 404, 'NOT_FOUND');
  }

  if (rec.created) {
    return { alreadyExists: true, indexName: rec.indexName };
  }

  // Validate table is allowed
  if (!ALLOWED_TABLES.has(rec.table)) {
    throw createError(
      `Table "${rec.table}" is not allowed for demo indexes.`,
      403, 'FORBIDDEN_TABLE'
    );
  }

  // Validate table/columns exist in the database
  const pool = getAdminPool();
  for (const column of rec.columns) {
    const check = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    `, [rec.table, column]);

    if (check.rows.length === 0) {
      throw createError(
        `Column "${column}" does not exist in table "${rec.table}".`,
        400, 'INVALID_COLUMN'
      );
    }
  }

  // Validate index name pattern
  if (!isValidIndexName(rec.indexName)) {
    throw createError(
      'Invalid index name pattern.',
      400, 'INVALID_INDEX_NAME'
    );
  }

  // Check that index doesn't already exist
  const existsCheck = await pool.query(`
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = $1
  `, [rec.indexName]);

  if (existsCheck.rows.length > 0) {
    rec.created = true;
    return { alreadyExists: true, indexName: rec.indexName };
  }

  // Generate and execute the CREATE INDEX SQL
  const quotedIndex = quoteIdentifier(rec.indexName);
  const quotedTable = quoteIdentifier(rec.table);
  const quotedColumns = rec.columns.map(c => quoteIdentifier(c)).join(', ');

  const createSql = `CREATE INDEX ${quotedIndex} ON ${quotedTable}(${quotedColumns})`;

  await pool.query(createSql);

  // Run ANALYZE on the table
  await pool.query(`ANALYZE ${quotedTable}`);

  rec.created = true;
  activeDemoIndexes.set(serverId, rec);

  return { alreadyExists: false, indexName: rec.indexName };
}

/**
 * Drop a specific demo index.
 */
async function dropDemoIndex(serverId) {
  const rec = activeDemoIndexes.get(serverId);
  if (!rec || !rec.created) return;

  const pool = getAdminPool();
  const quotedIndex = quoteIdentifier(rec.indexName);

  try {
    await pool.query(`DROP INDEX IF EXISTS ${quotedIndex}`);
  } catch (err) {
    console.error(`Failed to drop index ${rec.indexName}:`, err.message);
  }

  rec.created = false;
  activeDemoIndexes.set(serverId, rec);
}

/**
 * Drop ALL demo indexes and clear the store.
 */
async function dropAllDemoIndexes() {
  const pool = getAdminPool();
  const dropped = [];

  for (const [id, rec] of activeDemoIndexes.entries()) {
    if (rec.created) {
      try {
        const quotedIndex = quoteIdentifier(rec.indexName);
        await pool.query(`DROP INDEX IF EXISTS ${quotedIndex}`);
        dropped.push(rec.indexName);
      } catch (err) {
        console.error(`Failed to drop index ${rec.indexName}:`, err.message);
      }
    }
  }

  activeDemoIndexes.clear();
  return dropped;
}

/**
 * Get list of active demo indexes.
 */
function getActiveDemoIndexes() {
  const result = [];
  for (const [id, rec] of activeDemoIndexes.entries()) {
    if (rec.created) {
      result.push({
        serverId: id,
        indexName: rec.indexName,
        table: rec.table,
        columns: rec.columns
      });
    }
  }
  return result;
}

module.exports = {
  storeRecommendation,
  getStoredRecommendation,
  createDemoIndex,
  dropDemoIndex,
  dropAllDemoIndexes,
  getActiveDemoIndexes
};
