/*
  # Add Celebration Modal Labels

  Adds CMS labels for the post-signup celebration modal experience.

  1. New Labels
    - celebration.welcome_header - "Welcome to JOKO TODAY!" / "ยินดีต้อนรับสู่ JOKO TODAY!"
    - celebration.qr_ready - "Your personal QR code is ready." / "QR Code ส่วนตัวของคุณพร้อมใช้งานแล้ว"
    - celebration.qr_description - "This is your fast pass for easy pickup & login." / "ใช้สำหรับเข้าสู่ระบบและรับสินค้าได้อย่างรวดเร็ว"
    - celebration.steps_title - "3 Easy Steps" / "3 ขั้นตอนง่ายๆ"
    - celebration.save_qr_button - "Save QR to Phone" / "บันทึก QR ลงมือถือ"
    - celebration.go_profile_button - "Go to My Profile" / "ไปที่โปรไฟล์ของฉัน"
    - celebration.dismiss_button - "Dismiss" / "ปิด"
*/

INSERT INTO cms_labels (key, text_en, text_th)
VALUES
  ('celebration.welcome_header', 'Welcome to JOKO TODAY!', 'ยินดีต้อนรับสู่ JOKO TODAY!'),
  ('celebration.qr_ready', 'Your personal QR code is ready.', 'QR Code ส่วนตัวของคุณพร้อมใช้งานแล้ว'),
  ('celebration.qr_description', 'This is your fast pass for easy pickup & login.', 'ใช้สำหรับเข้าสู่ระบบและรับสินค้าได้อย่างรวดเร็ว'),
  ('celebration.steps_title', '3 Easy Steps', '3 ขั้นตอนง่ายๆ'),
  ('celebration.save_qr_button', 'Save QR to Phone', 'บันทึก QR ลงมือถือ'),
  ('celebration.go_profile_button', 'Go to My Profile', 'ไปที่โปรไฟล์ของฉัน'),
  ('celebration.dismiss_button', 'Dismiss', 'ปิด')
ON CONFLICT (key) DO NOTHING;
