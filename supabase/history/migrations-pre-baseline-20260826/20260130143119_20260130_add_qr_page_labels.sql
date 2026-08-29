/*
  # Add QR Page Labels

  Adds CMS labels for the My QR Page with branded card design and download options.

  1. New Labels
    - qr_page.header - "Your JOKO Pass 🎫" / "Your JOKO Pass 🎫"
    - qr_page.subtitle - "Show this QR when you visit us — it's your personal JOKO TODAY ID." / "แสดง QR นี้เมื่อคุณมาเยี่ยมเรา — มันคือ ID ส่วนตัวของคุณ"
    - qr_page.download_card_button - "Download as Card" / "ดาวน์โหลดเป็นบัตร"
    - qr_page.download_image_button - "Download as Image" / "ดาวน์โหลดเป็นรูปภาพ"
    - qr_page.card_info - "You can save it to your phone or print it as a small card for your wallet." / "บันทึกไว้ในโทรศัพท์หรือพิมพ์ไว้ในกระเป๋าสตางค์ของคุณ"
    - qr_page.always_here - "You can always find this QR again in your account." / "คุณสามารถค้นหา QR นี้ได้ตลอดเวลาในบัญชีของคุณ"
*/

INSERT INTO cms_labels (key, text_en, text_th)
VALUES
  ('qr_page.header', 'Your JOKO Pass 🎫', 'Your JOKO Pass 🎫'),
  ('qr_page.subtitle', 'Show this QR when you visit us — it''s your personal JOKO TODAY ID.', 'แสดง QR นี้เมื่อคุณมาเยี่ยมเรา — มันคือ ID ส่วนตัวของคุณ'),
  ('qr_page.download_card_button', 'Download as Card', 'ดาวน์โหลดเป็นบัตร'),
  ('qr_page.download_image_button', 'Download as Image', 'ดาวน์โหลดเป็นรูปภาพ'),
  ('qr_page.card_info', 'You can save it to your phone or print it as a small card for your wallet.', 'บันทึกไว้ในโทรศัพท์หรือพิมพ์ไว้ในกระเป๋าสตางค์ของคุณ'),
  ('qr_page.always_here', 'You can always find this QR again in your account.', 'คุณสามารถค้นหา QR นี้ได้ตลอดเวลาในบัญชีของคุณ')
ON CONFLICT (key) DO NOTHING;
