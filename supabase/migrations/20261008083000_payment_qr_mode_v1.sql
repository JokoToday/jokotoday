-- Add a switchable QR rail so JOKO can test K SHOP merchant QR
-- while preserving the existing personal PromptPay implementation as fallback.

ALTER TABLE public.payment_settings
  ADD COLUMN IF NOT EXISTS payment_qr_mode text NOT NULL DEFAULT 'promptpay_legacy';

ALTER TABLE public.payment_settings
  DROP CONSTRAINT IF EXISTS payment_settings_payment_qr_mode_check;

ALTER TABLE public.payment_settings
  ADD CONSTRAINT payment_settings_payment_qr_mode_check
  CHECK (payment_qr_mode IN ('promptpay_legacy','kshop_easyslip'));

COMMENT ON COLUMN public.payment_settings.payment_qr_mode IS
'QR generation mode. promptpay_legacy preserves the original PROMPTPAY_ID flow; kshop_easyslip generates a KBANK K SHOP merchant QR through EasySlip v1.';
