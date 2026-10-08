-- Add genuine K SHOP master-QR mode while preserving both existing fallbacks.

ALTER TABLE public.payment_settings
  DROP CONSTRAINT IF EXISTS payment_settings_payment_qr_mode_check;

ALTER TABLE public.payment_settings
  ADD CONSTRAINT payment_settings_payment_qr_mode_check
  CHECK (payment_qr_mode IN ('promptpay_legacy','kshop_easyslip','kshop_master'));

COMMENT ON COLUMN public.payment_settings.payment_qr_mode IS
'QR generation mode. kshop_master derives an amount-specific QR from the genuine K SHOP master QR payload; kshop_easyslip uses EasySlip v1 K SHOP generation; promptpay_legacy preserves the original PROMPTPAY_ID fallback.';
