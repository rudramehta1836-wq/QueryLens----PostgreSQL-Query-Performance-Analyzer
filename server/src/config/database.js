const { Pool } = require('pg');

let appPool = null;
let adminPool = null;

/**
 * Read-only pool for query analysis (querylens_app role).
 */
function getAppPool() {
  if (!appPool) {
    appPool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      database: process.env.DATABASE_NAME || 'querylens',
      user: process.env.DATABASE_USER || 'querylens_app',
      password: process.env.DATABASE_PASSWORD || 'querylens_password',
      max: 10,
      statement_timeout: parseInt(process.env.QUERY_TIMEOUT_MS || '5000', 10)
    });
  }
  return appPool;
}

/**
 * Admin pool for controlled index creation / deletion (querylens_admin role).
 */
function getAdminPool() {
  if (!adminPool) {
    adminPool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      database: process.env.DATABASE_NAME || 'querylens',
      user: process.env.DATABASE_ADMIN_USER || 'querylens_admin',
      password: process.env.DATABASE_ADMIN_PASSWORD || 'querylens_admin_password',
      max: 5,
      statement_timeout: 30000 // longer timeout for index ops
    });
  }
  return adminPool;
}

/**
 * Gracefully close pools.
 */
async function closePools() {
  if (appPool) await appPool.end();
  if (adminPool) await adminPool.end();
  appPool = null;
  adminPool = null;
}

module.exports = { getAppPool, getAdminPool, closePools };
