/**
 * Recursive PostgreSQL EXPLAIN plan parser.
 * Converts raw plan JSON into a frontend-friendly tree structure
 * with stable generated IDs.
 */

let nodeCounter = 0;

/**
 * Parse a PostgreSQL plan node into a frontend-friendly structure.
 *
 * @param {Object} rawNode - A plan node from EXPLAIN JSON
 * @param {number|null} parentId - Parent node index (for ID generation)
 * @returns {Object} Parsed plan node
 */
function parsePlanNode(rawNode, depth = 0) {
  if (!rawNode) return null;

  nodeCounter++;
  const id = `node-${nodeCounter}`;

  const node = {
    id,
    nodeType: rawNode['Node Type'] || 'Unknown',
    relationName: rawNode['Relation Name'] || null,
    schema: rawNode['Schema'] || null,
    alias: rawNode['Alias'] || null,
    indexName: rawNode['Index Name'] || null,
    scanDirection: rawNode['Scan Direction'] || null,

    // Cost estimates
    startupCost: rawNode['Startup Cost'] || 0,
    totalCost: rawNode['Total Cost'] || 0,
    planRows: rawNode['Plan Rows'] || 0,
    planWidth: rawNode['Plan Width'] || 0,

    // Actual execution stats
    actualStartupTime: rawNode['Actual Startup Time'] || 0,
    actualTotalTime: rawNode['Actual Total Time'] || 0,
    actualRows: rawNode['Actual Rows'] || 0,
    actualLoops: rawNode['Actual Loops'] || 1,

    // Timing
    actualTime: (rawNode['Actual Total Time'] || 0) * (rawNode['Actual Loops'] || 1),

    // Conditions
    filter: rawNode['Filter'] || null,
    indexCondition: rawNode['Index Cond'] || null,
    hashCondition: rawNode['Hash Cond'] || null,
    joinFilter: rawNode['Join Filter'] || null,
    mergeCondition: rawNode['Merge Cond'] || null,
    recheckCondition: rawNode['Recheck Cond'] || null,
    oneTimeFilter: rawNode['One-Time Filter'] || null,

    // Rows removed
    rowsRemovedByFilter: rawNode['Rows Removed by Filter'] || 0,
    rowsRemovedByIndexRecheck: rawNode['Rows Removed by Index Recheck'] || 0,
    rowsRemovedByJoinFilter: rawNode['Rows Removed by Join Filter'] || 0,

    // Sort info
    sortKey: rawNode['Sort Key'] || null,
    sortMethod: rawNode['Sort Method'] || null,
    sortSpaceUsed: rawNode['Sort Space Used'] || 0,
    sortSpaceType: rawNode['Sort Space Type'] || null,

    // Buffers
    buffers: {
      sharedHit: rawNode['Shared Hit Blocks'] || 0,
      sharedRead: rawNode['Shared Read Blocks'] || 0,
      sharedDirtied: rawNode['Shared Dirtied Blocks'] || 0,
      sharedWritten: rawNode['Shared Written Blocks'] || 0,
      localHit: rawNode['Local Hit Blocks'] || 0,
      localRead: rawNode['Local Read Blocks'] || 0,
      tempRead: rawNode['Temp Read Blocks'] || 0,
      tempWritten: rawNode['Temp Written Blocks'] || 0,
    },

    // Hash info
    hashBuckets: rawNode['Hash Buckets'] || null,
    hashBatches: rawNode['Hash Batches'] || null,
    peakMemoryUsage: rawNode['Peak Memory Usage'] || null,

    // Parallel info
    workersPlanned: rawNode['Workers Planned'] || null,
    workersLaunched: rawNode['Workers Launched'] || null,

    // Output columns
    output: rawNode['Output'] || null,

    // CTE name
    cteName: rawNode['CTE Name'] || null,
    parentRelationship: rawNode['Parent Relationship'] || null,
    subplanName: rawNode['Subplan Name'] || null,

    // Join type
    joinType: rawNode['Join Type'] || null,

    // Strategy
    strategy: rawNode['Strategy'] || null,
    partialMode: rawNode['Partial Mode'] || null,

    // Depth for indentation
    depth,

    // Children
    children: []
  };

  // Recursively parse child plans
  if (rawNode.Plans && Array.isArray(rawNode.Plans)) {
    node.children = rawNode.Plans.map(child => parsePlanNode(child, depth + 1));
  }

  return node;
}

/**
 * Parse a complete execution plan.
 * Resets the node counter for each new plan.
 *
 * @param {Object} rawPlan - The raw Plan object from EXPLAIN JSON
 * @returns {Object} The parsed plan tree
 */
function parsePlan(rawPlan) {
  nodeCounter = 0;
  return parsePlanNode(rawPlan);
}

/**
 * Flatten a plan tree into a list of nodes (for analysis).
 *
 * @param {Object} node - Root of the parsed plan tree
 * @returns {Object[]} Array of all nodes
 */
function flattenPlan(node) {
  if (!node) return [];
  const nodes = [node];
  if (node.children) {
    for (const child of node.children) {
      nodes.push(...flattenPlan(child));
    }
  }
  return nodes;
}

module.exports = { parsePlan, flattenPlan, parsePlanNode };
