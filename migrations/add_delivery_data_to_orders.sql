USE jetjet_store;

SET @exist_delivery := (SELECT COUNT(*) FROM information_schema.COLUMNS 
                        WHERE TABLE_SCHEMA = 'jetjet_store' 
                          AND TABLE_NAME = 'orders' 
                          AND COLUMN_NAME = 'delivery_data');

SET @query_delivery := IF(@exist_delivery = 0,
    'ALTER TABLE orders ADD COLUMN delivery_data TEXT NULL AFTER status, ADD COLUMN delivered_at TIMESTAMP NULL AFTER delivery_data;',
    'SELECT "Columns delivery_data and delivered_at already exist"');

PREPARE stmt FROM @query_delivery;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
