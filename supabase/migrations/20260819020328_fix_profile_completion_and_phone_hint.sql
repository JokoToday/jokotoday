-- Reconcile existing profile completion state with current frontend rules.
-- A profile is complete when it has a name, phone number, and at least one
-- supported contact method. This migration is idempotent.
UPDATE public.user_profiles
SET
  profile_completed = true,
  updated_at = now()
WHERE COALESCE(profile_completed, false) = false
  AND btrim(COALESCE(name, '')) <> ''
  AND btrim(COALESCE(phone, '')) <> ''
  AND (
    btrim(COALESCE(line_id, '')) <> ''
    OR btrim(COALESCE(whatsapp, '')) <> ''
    OR btrim(COALESCE(wechat_id, '')) <> ''
  );

-- Correct misleading SMS copy in the profile completion flow.
UPDATE public.cms_labels
SET
  text_en = 'We''ll use this to contact you about your order if needed',
  text_th = 'เราจะใช้เบอร์นี้เพื่อติดต่อคุณเกี่ยวกับออเดอร์หากจำเป็น',
  text_zh = '如有需要，我们会通过此号码联系您处理订单',
  updated_at = now()
WHERE key = 'profile.phone_hint';
