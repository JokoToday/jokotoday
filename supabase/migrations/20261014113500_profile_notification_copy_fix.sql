BEGIN;

UPDATE public.cms_labels
SET
  text_en = 'Please selected your preferred notifications channel.',
  text_th = 'กรุณาเลือกช่องทางการแจ้งเตือนที่คุณต้องการ',
  text_zh = '请选择您偏好的通知方式。',
  updated_at = now()
WHERE key = 'profile.notifications_required_error';

COMMIT;
