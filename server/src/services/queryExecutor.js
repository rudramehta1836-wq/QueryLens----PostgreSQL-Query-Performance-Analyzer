const { getAppPool } = require('../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * Execute EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, VERBOSE, SETTINGS)
 * on a validated query inside a read-only transaction.
 *
 * @param {string} sql - A validated SELECT query
 * @returns {Object} - { plan, planningTime, executionTime }
 */
async function executeExplain(sql) {
  const pool = getAppPool();
  const client = await pool.connect();

  try {
    // Begin a read-only transaction
    await client.query('BEGIN TRANSACTION READ ONLY');
    await client.query(`SET LOCAL statement_timeout = '${parseInt(process.env.QUERY_TIMEOUT_MS || '5000', 10)}'`);

    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, VERBOSE, SETTINGS) ${sql}`;

    const result = await client.query(explainSql);

    await client.query('ROLLBACK'); // always rollback — read-only anyway

    if (!result.rows || result.rows.length === 0) {
      throw createError('No execution plan returned.', 500, 'EXPLAIN_FAILED');
    }

    // PostgreSQL returns the plan in result.rows[0]['QUERY PLAN']
    const planData = result.rows[0]['QUERY PLAN'];

    if (!planData || !Array.isArray(planData) || planData.length === 0) {
      throw createError('Invalid execution plan format.', 500, 'EXPLAIN_FAILED');
    }

    const topLevel = planData[0];

    return {
      plan: topLevel.Plan,
      planningTime: topLevel['Planning Time'] || 0,
      executionTime: topLevel['Execution Time'] || 0,
      settings: topLevel.Settings || {},
      triggers: topLevel.Triggers || [],
      rawPlan: planData
    };
  } catch (err) {
    // Try to rollback on error
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }

    if (err.errorCode) throw err; // re-throw our errors

    // Handle PostgreSQL-specific errors
    if (err.code === '57014') {
      throw createError(
        'Query timed out. Try a simpler query.',
        408, 'QUERY_TIMEOUT'
      );
    }

    if (err.code === '42P01') {
      throw createError(
        `Table not found: ${err.message}`,
        400, 'TABLE_NOT_FOUND'
      );
    }

    if (err.code === '42703') {
      throw createError(
        `Column not found: ${err.message}`,
        400, 'COLUMN_NOT_FOUND'
      );
    }

    throw createError(
      `Query execution failed: ${err.message}`,
      400, 'QUERY_ERROR'
    );
  } finally {
    client.release();
  }
}

/**
 * Execute EXPLAIN with a specific connection pool (used for before-vs-after).
 */
async function executeExplainWithPool(pool, sql) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    await client.query(`SET LOCAL statement_timeout = '${parseInt(process.env.QUERY_TIMEOUT_MS || '5000', 10)}'`);

    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, VERBOSE, SETTINGS) ${sql}`;
    const result = await client.query(explainSql);

    await client.query('ROLLBACK');

    if (!result.rows || result.rows.length === 0) {
      throw createError('No execution plan returned.', 500, 'EXPLAIN_FAILED');
    }

    const planData = result.rows[0]['QUERY PLAN'];
    if (!planData || !Array.isArray(planData) || planData.length === 0) {
      throw createError('Invalid execution plan format.', 500, 'EXPLAIN_FAILED');
    }

    const topLevel = planData[0];

    return {
      plan: topLevel.Plan,
      planningTime: topLevel['Planning Time'] || 0,
      executionTime: topLevel['Execution Time'] || 0,
      rawPlan: planData
    };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { executeExplain, executeExplainWithPool };
