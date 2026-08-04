/**
 * Query analysis history service.
 * CRUD operations for the query_analysis_history table.
 */

const { getAppPool } = require('../config/database');

const MAX_HISTORY = parseInt(process.env.MAX_HISTORY_ITEMS || '100', 10);

/**
 * Save an analysis result to history.
 */
async function saveAnalysis({ queryText, executionTimeMs, planningTimeMs, findings, recommendations, plan }) {
  const pool = getAppPool();

  const result = await pool.query(`
    INSERT INTO query_analysis_history
      (query_text, execution_time_ms, planning_time_ms, findings_json, recommendations_json, plan_json)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, created_at
  `, [
    queryText,
    executionTimeMs,
    planningTimeMs,
    JSON.stringify(findings),
    JSON.stringify(recommendations),
    JSON.stringify(plan)
  ]);

  // Prune old entries if exceeding max
  await pool.query(`
    DELETE FROM query_analysis_history
    WHERE id NOT IN (
      SELECT id FROM query_analysis_history
      ORDER BY created_at DESC
      LIMIT $1
    )
  `, [MAX_HISTORY]);

  return result.rows[0];
}

/**
 * Get paginated history.
 */
async function getHistory(page = 1, limit = 20) {
  const pool = getAppPool();
  const offset = (page - 1) * limit;

  const countResult = await pool.query('SELECT COUNT(*) AS total FROM query_analysis_history');
  const total = parseInt(countResult.rows[0].total, 10);

  const result = await pool.query(`
    SELECT
      id,
      query_text,
      execution_time_ms,
      planning_time_ms,
      findings_json,
      recommendations_json,
      created_at
    FROM query_analysis_history
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);

  return {
    items: result.rows.map(row => ({
      id: row.id,
      queryText: row.query_text,
      executionTimeMs: parseFloat(row.execution_time_ms),
      planningTimeMs: parseFloat(row.planning_time_ms),
      findingsCount: row.findings_json ? row.findings_json.length : 0,
      recommendationsCount: row.recommendations_json ? row.recommendations_json.length : 0,
      createdAt: row.created_at
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Get a single history item by ID.
 */
async function getHistoryItem(id) {
  const pool = getAppPool();
  const result = await pool.query(`
    SELECT * FROM query_analysis_history WHERE id = $1
  `, [id]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    queryText: row.query_text,
    executionTimeMs: parseFloat(row.execution_time_ms),
    planningTimeMs: parseFloat(row.planning_time_ms),
    findings: row.findings_json,
    recommendations: row.recommendations_json,
    plan: row.plan_json,
    createdAt: row.created_at
  };
}

/**
 * Delete a history item.
 */
async function deleteHistoryItem(id) {
  const pool = getAppPool();
  const result = await pool.query(
    'DELETE FROM query_analysis_history WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rowCount > 0;
}

module.exports = { saveAnalysis, getHistory, getHistoryItem, deleteHistoryItem };
