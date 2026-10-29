-- Migration V55: Clean up EXPIRED competition registration payment statuses
-- Registration lifecycle allowed statuses: PENDING, SUCCESS, FAILED.

UPDATE competition_registrations
SET payment_status = CASE
    WHEN created_at >= NOW() - INTERVAL '5 days' THEN 'PENDING'
    ELSE 'FAILED'
END
WHERE UPPER(payment_status) = 'EXPIRED';

UPDATE competition_registrations
SET payment_status = 'SUCCESS'
WHERE UPPER(payment_status) IN ('PAID', 'SUCCESS');

UPDATE competition_registrations
SET payment_status = 'PENDING'
WHERE UPPER(payment_status) IN ('PENDING_PAYMENT', 'PENDING');
