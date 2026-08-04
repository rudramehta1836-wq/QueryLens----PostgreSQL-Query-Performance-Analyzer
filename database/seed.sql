-- QueryLens Seed Data
-- Generates realistic e-commerce data for performance demonstrations.
-- 5,000 customers · 100,000 orders · 200,000 order items

-- ============================================================
-- 1. Seed customers (5,000)
-- ============================================================
INSERT INTO customers (name, email, city, created_at)
SELECT
  'Customer ' || i,
  'customer' || i || '@example.com',
  (ARRAY[
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad',
    'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Lucknow',
    'Surat', 'Nagpur', 'Indore', 'Bhopal', 'Patna',
    'Vadodara', 'Ludhiana', 'Agra', 'Nashik', 'Kanpur'
  ])[1 + (i % 20)],
  TIMESTAMP '2023-01-01' + (random() * INTERVAL '730 days')
FROM generate_series(1, 5000) AS s(i);

-- ============================================================
-- 2. Seed orders (100,000)
-- ============================================================
INSERT INTO orders (customer_id, status, total_amount, order_date, shipping_city)
SELECT
  1 + (i % 5000),
  (ARRAY['pending', 'processing', 'shipped', 'delivered', 'cancelled'])[1 + (i % 5)],
  ROUND((random() * 9900 + 100)::numeric, 2),
  DATE '2023-01-01' + (i % 730),
  (ARRAY[
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Ahmedabad',
    'Chennai', 'Kolkata', 'Pune', 'Jaipur', 'Lucknow',
    'Surat', 'Nagpur', 'Indore', 'Bhopal', 'Patna',
    'Vadodara', 'Ludhiana', 'Agra', 'Nashik', 'Kanpur'
  ])[1 + (i % 20)]
FROM generate_series(1, 100000) AS s(i);

-- ============================================================
-- 3. Seed order items (200,000)
-- ============================================================
INSERT INTO order_items (order_id, product_name, category, quantity, unit_price)
SELECT
  1 + (i % 100000),
  'Product ' || (1 + (i % 500)),
  (ARRAY[
    'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports',
    'Toys', 'Food', 'Health', 'Automotive', 'Music'
  ])[1 + (i % 10)],
  1 + (i % 10),
  ROUND((random() * 990 + 10)::numeric, 2)
FROM generate_series(1, 200000) AS s(i);

-- ============================================================
-- 4. Update table statistics for the planner
-- ============================================================
ANALYZE customers;
ANALYZE orders;
ANALYZE order_items;
