-- A visit's landing page must never hold an order link (its token is a key to the order): earlier rows may. Keep only `/orders/*`.
UPDATE `visits` SET `landing_path` = REGEXP_REPLACE(`landing_path`, '^(/ur)?/orders/[^/]+.*$', '$1/orders/*') WHERE `landing_path` REGEXP '^(/ur)?/orders/[^/]+';
