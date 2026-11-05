USE jetjet_store;

SET @exist_auto := (SELECT COUNT(*) FROM information_schema.COLUMNS 
                    WHERE TABLE_SCHEMA = 'jetjet_store' 
                      AND TABLE_NAME = 'products' 
                      AND COLUMN_NAME = 'auto_delivery_content');

SET @query_auto := IF(@exist_auto = 0,
    'ALTER TABLE products ADD COLUMN auto_delivery_content TEXT NULL AFTER stock;',
    'SELECT "Column auto_delivery_content already exists"');

PREPARE stmt FROM @query_auto;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
