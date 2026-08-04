/**
 * Analysis controller.
 * Handles query analysis and example queries.
 */

const { validateQuery } = require('../services/sqlGuard');
const { executeExplain } = require('../services/queryExecutor');
const { parsePlan } = require('../services/planParser');
const { analyzeBottlenecks } = require('../analyzers/bottleneckAnalyzer');
const { generateRecommendations } = require('../analyzers/indexAdvisor');
const { storeRecommendation } = require('../services/indexManager');
const { saveAnalysis } = require('../services/historyService');

// Sample queries for the frontend dropdown
const EXAMPLE_QUERIES = [
  {
    id: 'customer-order-lookup',
    name: 'Customer order lookup',
    description: 'Find all orders for a specific customer',
    sql: `SELECT *\nFROM orders\nWHERE customer_id = 2500;`
  },
  {
    id: 'shipping-city-filter',
    name: 'Orders by shipping city',
    description: 'Filter orders shipped to a specific city',
    sql: `SELECT *\nFROM orders\nWHERE shipping_city = 'Ahmedabad';`
  },
  {
    id: 'status-filter',
    name: 'Orders by status',
    description: 'Find all pending orders',
    sql: `SELECT *\nFROM orders\nWHERE status = 'pending';`
  },
  {
    id: 'product-lookup',
    name: 'Order item product lookup',
    description: 'Find order items by product name',
    sql: `SELECT *\nFROM order_items\nWHERE product_name = 'Product 125';`
  },
  {
    id: 'join-query',
    name: 'Customer orders join',
    description: 'Join customers and orders with email filter',
    sql: `SELECT\n    c.name,\n    o.id,\n    o.total_amount,\n    o.order_date\nFROM customers c\nJOIN orders o ON c.id = o.customer_id\nWHERE c.email = 'customer2500@example.com';`
  },
  {
    id: 'category-sum',
    name: 'Category revenue',
    description: 'Total revenue by product category',
    sql: `SELECT\n    category,\n    SUM(quantity * unit_price) AS total_revenue,\n    COUNT(*) AS item_count\nFROM order_items\nGROUP BY category\nORDER BY total_revenue DESC;`
  }
];

/**
 * GET /api/examples
 */
async function getExamples(_req, res) {
  res.json({
    success: true,
    data: EXAMPLE_QUERIES,
    error: null
  });
}

/**
 * POST /api/analyse
 */
async function analyseQuery(req, res, next) {
  try {
    const { sql } = req.validatedBody;

    // Layer 1–5: Validate query safety
    const { sql: validatedSql } = validateQuery(sql);

    // Execute EXPLAIN ANALYZE
    const explainResult = await executeExplain(validatedSql);

    // Parse the plan into a frontend-friendly tree
    const parsedPlan = parsePlan(explainResult.plan);

    // Analyze bottlenecks
    const findings = analyzeBottlenecks(parsedPlan, explainResult.executionTime);

    // Generate index recommendations
    const recommendations = await generateRecommendations(
      parsedPlan, findings, validatedSql
    );

    // Store recommendations server-side for before-vs-after testing
    const storedRecommendations = recommendations.map(rec => {
      const serverId = storeRecommendation(rec);
      return { ...rec, serverId };
    });

    // Save to history
    let historyId = null;
    try {
      const historyEntry = await saveAnalysis({
        queryText: validatedSql,
        executionTimeMs: explainResult.executionTime,
        planningTimeMs: explainResult.planningTime,
        findings,
        recommendations: storedRecommendations,
        plan: parsedPlan
      });
      historyId = historyEntry.id;
    } catch (historyErr) {
      console.error('Failed to save history:', historyErr.message);
      // Don't fail the analysis if history save fails
    }

    res.json({
      success: true,
      data: {
        query: validatedSql,
        summary: {
          executionTimeMs: explainResult.executionTime,
          planningTimeMs: explainResult.planningTime,
          totalCost: parsedPlan.totalCost,
          actualRows: parsedPlan.actualRows,
          nodeType: parsedPlan.nodeType
        },
        plan: parsedPlan,
        findings,
        recommendations: storedRecommendations,
        historyId
      },
      error: null
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getExamples, analyseQuery, EXAMPLE_QUERIES };
