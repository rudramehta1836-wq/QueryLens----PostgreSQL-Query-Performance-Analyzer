/**
 * Index controller.
 * Handles before-vs-after testing and demo index cleanup.
 */

const { createError } = require('../middleware/errorHandler');
const {
  getStoredRecommendation,
  createDemoIndex,
  dropDemoIndex,
  dropAllDemoIndexes,
  getActiveDemoIndexes
} = require('../services/indexManager');
const { executeExplainWithPool } = require('../services/queryExecutor');
const { parsePlan } = require('../services/planParser');
const { analyzeBottlenecks } = require('../analyzers/bottleneckAnalyzer');
const { getAdminPool } = require('../config/database');
const { validateQuery } = require('../services/sqlGuard');

/**
 * POST /api/recommendations/:id/test
 * Runs before-vs-after comparison for a recommendation.
 */
async function testRecommendation(req, res, next) {
  try {
    const serverId = req.params.id;
    const rec = getStoredRecommendation(serverId);

    if (!rec) {
      throw createError(
        'Recommendation not found. Please re-run the analysis.',
        404, 'NOT_FOUND'
      );
    }

    // We need the original query from the request body
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      throw createError('Query SQL is required for comparison.', 400, 'MISSING_QUERY');
    }

    // Validate the query again for safety
    const { sql: validatedSql } = validateQuery(sql);

    const pool = getAdminPool();

    // ---- BEFORE: Run EXPLAIN without the index ----
    // First drop the index if it exists
    await dropDemoIndex(serverId);

    // Small delay to ensure the drop is committed
    const beforeResult = await executeExplainWithPool(pool, validatedSql);
    const beforePlan = parsePlan(beforeResult.plan);

    // ---- Create the index ----
    await createDemoIndex(serverId);

    // ---- AFTER: Run EXPLAIN with the index ----
    const afterResult = await executeExplainWithPool(pool, validatedSql);
    const afterPlan = parsePlan(afterResult.plan);

    // ---- Compare ----
    const comparison = buildComparison(
      beforeResult, beforePlan,
      afterResult, afterPlan,
      rec
    );

    res.json({
      success: true,
      data: {
        recommendation: {
          indexName: rec.indexName,
          table: rec.table,
          columns: rec.columns,
          sql: rec.sql
        },
        before: {
          executionTimeMs: beforeResult.executionTime,
          planningTimeMs: beforeResult.planningTime,
          plan: beforePlan
        },
        after: {
          executionTimeMs: afterResult.executionTime,
          planningTimeMs: afterResult.planningTime,
          plan: afterPlan
        },
        comparison
      },
      error: null
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Build comparison metrics between before and after plans.
 */
function buildComparison(beforeResult, beforePlan, afterResult, afterPlan, rec) {
  const beforeTime = beforeResult.executionTime;
  const afterTime = afterResult.executionTime;

  const timeSaved = beforeTime - afterTime;
  const improvement = beforeTime > 0
    ? ((timeSaved) / beforeTime) * 100
    : 0;

  // Find scan type changes
  const beforeScanType = findScanType(beforePlan, rec.table);
  const afterScanType = findScanType(afterPlan, rec.table);

  // Check if the new index was used
  const indexUsed = checkIndexUsed(afterPlan, rec.indexName);

  // Get row counts
  const beforeRows = getTotalRowsScanned(beforePlan, rec.table);
  const afterRows = getTotalRowsScanned(afterPlan, rec.table);

  // Get buffer usage
  const beforeBuffers = getTotalBuffers(beforePlan);
  const afterBuffers = getTotalBuffers(afterPlan);

  let reason = null;
  if (!indexUsed) {
    reason = 'PostgreSQL chose not to use the index. This can happen when the table is small ' +
      'enough that a sequential scan is faster, or when the selectivity of the filter is low.';
  }

  return {
    beforeTimeMs: Math.round(beforeTime * 100) / 100,
    afterTimeMs: Math.round(afterTime * 100) / 100,
    timeSavedMs: Math.round(timeSaved * 100) / 100,
    improvementPercent: Math.round(improvement * 100) / 100,
    beforeScanType,
    afterScanType,
    beforeRowsProcessed: beforeRows,
    afterRowsProcessed: afterRows,
    beforeSharedBlocks: beforeBuffers.sharedHit + beforeBuffers.sharedRead,
    afterSharedBlocks: afterBuffers.sharedHit + afterBuffers.sharedRead,
    indexUsed,
    reason
  };
}

/**
 * Find the scan type used for a specific table in the plan.
 */
function findScanType(node, tableName) {
  if (!node) return 'Unknown';
  if (node.relationName === tableName) {
    return node.nodeType;
  }
  if (node.children) {
    for (const child of node.children) {
      const result = findScanType(child, tableName);
      if (result !== 'Unknown') return result;
    }
  }
  return 'Unknown';
}

/**
 * Check if a specific index was used in the plan.
 */
function checkIndexUsed(node, indexName) {
  if (!node) return false;
  if (node.indexName === indexName) return true;
  if (node.children) {
    return node.children.some(child => checkIndexUsed(child, indexName));
  }
  return false;
}

/**
 * Get total rows scanned for a table.
 */
function getTotalRowsScanned(node, tableName) {
  if (!node) return 0;
  let total = 0;
  if (node.relationName === tableName) {
    total += (node.actualRows + node.rowsRemovedByFilter) * (node.actualLoops || 1);
  }
  if (node.children) {
    for (const child of node.children) {
      total += getTotalRowsScanned(child, tableName);
    }
  }
  return total;
}

/**
 * Get total buffer usage for a plan.
 */
function getTotalBuffers(node) {
  if (!node) return { sharedHit: 0, sharedRead: 0 };
  return {
    sharedHit: node.buffers ? node.buffers.sharedHit : 0,
    sharedRead: node.buffers ? node.buffers.sharedRead : 0
  };
}

/**
 * DELETE /api/demo-indexes
 */
async function resetDemoIndexes(_req, res, next) {
  try {
    const dropped = await dropAllDemoIndexes();
    res.json({
      success: true,
      data: { dropped, count: dropped.length },
      error: null
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { testRecommendation, resetDemoIndexes };
