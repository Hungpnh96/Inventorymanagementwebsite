-- Track unit price per import/export transaction so we can:
--  - Compute value of stock at any point in time
--  - Show price history chart per SKU
--  - Recompute weighted-average cost automatically
BEGIN;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0;

-- Backfill: for existing rows set unit_price = current product.gia_von.
-- Better than nothing; more accurate history starts from this migration onward.
UPDATE transactions t
   SET unit_price = COALESCE(p.gia_von, 0)
  FROM products p
 WHERE t.ma_sku = p.ma_sku
   AND t.unit_price = 0;

CREATE INDEX IF NOT EXISTS ix_transactions_ma_sku_date
    ON transactions(ma_sku, date DESC);

COMMIT;
