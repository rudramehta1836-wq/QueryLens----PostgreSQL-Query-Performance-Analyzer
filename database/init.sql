-- QueryLens Database Initialization
-- Creates roles, tables, and minimal indexes.
-- Intentionally leaves many filter columns UNINDEXED to demonstrate sequential scans.

-- ============================================================
-- 1. Create application roles
-- ============================================================

-- Read-only role for query analysis
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'querylens_app') THEN
    CREATE ROLE querylens_app WITH LOGIN PASSWORD 'querylens_password';
  END IF;
END
$$;

-- Admin role for controlled index operations
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'querylens_admin') THEN
    CREATE ROLE querylens_admin WITH LOGIN PASSWORD 'querylens_admin_password';
  END IF;
END
$$;

-- ============================================================
-- 2. Create tables
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  city          VARCHAR(80)  NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  customer_id    INTEGER      NOT NULL REFERENCES customers(id),
  status         VARCHAR(20)  NOT NULL,
  total_amount   NUMERIC(10,2) NOT NULL,
  order_date     DATE         NOT NULL,
  shipping_city  VARCHAR(80)  NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER      NOT NULL REFERENCES orders(id),
  product_name  VARCHAR(120) NOT NULL,
  category      VARCHAR(60)  NOT NULL,
  quantity      INTEGER      NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS query_analysis_history (
  id                   SERIAL PRIMARY KEY,
  query_text           TEXT         NOT NULL,
  execution_time_ms    NUMERIC(10,2),
  planning_time_ms     NUMERIC(10,2),
  findings_json        JSONB,
  recommendations_json JSONB,
  plan_json            JSONB,
  created_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. Indexes — ONLY essential ones
-- ============================================================
-- Primary keys already have indexes.
-- Foreign keys on orders.customer_id and order_items.order_id are
-- intentionally LEFT UNINDEXED to demonstrate sequential scans.
-- 
-- DO NOT add indexes on: customer_id, shipping_city, status,
-- product_name, category, email, city — these are demo targets.

-- ============================================================
-- 4. Grant permissions
-- ============================================================

-- querylens_app: read-only on all demo tables
GRANT CONNECT ON DATABASE querylens TO querylens_app;
GRANT USAGE ON SCHEMA public TO querylens_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO querylens_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO querylens_app;

-- querylens_admin: full access for index management
GRANT CONNECT ON DATABASE querylens TO querylens_admin;
GRANT USAGE ON SCHEMA public TO querylens_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO querylens_admin;
GRANT CREATE ON SCHEMA public TO querylens_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO querylens_admin;

-- querylens_admin needs to create/drop indexes and run ANALYZE
GRANT ALL ON ALL TABLES IN SCHEMA public TO querylens_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO querylens_admin;

-- Transfer ownership of demo tables to querylens_admin so it can CREATE/DROP indexes.
-- (PostgreSQL requires table ownership for index creation, GRANT ALL alone is insufficient.)
ALTER TABLE customers OWNER TO querylens_admin;
ALTER TABLE orders OWNER TO querylens_admin;
ALTER TABLE order_items OWNER TO querylens_admin;

-- querylens_app needs INSERT/DELETE on history table
GRANT INSERT, DELETE ON query_analysis_history TO querylens_app;
GRANT USAGE ON SEQUENCE query_analysis_history_id_seq TO querylens_app;

