/*
  # Add Profile, Orders, and Navigation CMS Labels

  1. Overview
    - Adds warm, bakery-style microcopy for profile, orders, and navigation
    - All text is bilingual (EN/TH) and editable via CMS
    - Tone: warm, local bakery, friendly, cozy, Ghibli-inspired

  2. New Labels
    - Navigation: dropdown menu items
    - My QR Code page: headers, instructions, buttons
    - My Profile page: headers, fields, security section
    - My Orders page: tabs, order cards, status labels
    - General: success messages, confirmations

  3. Design Notes
    - Emphasizes warmth, personal touch, and community
    - Uses conversational language with emojis
    - Explains benefits clearly
*/

-- Insert warm, bakery-style navigation and profile labels
INSERT INTO cms_labels (key, text_en, text_th) VALUES
  -- Navigation / Header
  ('nav.signin_signup', 'Sign In / Sign Up', 'เข้าสู่ระบบ / สมัครสมาชิก'),
  ('nav.my_qr', 'My QR Code', 'QR โค้ดของฉัน'),
  ('nav.my_orders', 'My Orders', 'ออเดอร์ของฉัน'),
  ('nav.my_profile', 'My Profile', 'โปรไฟล์ของฉัน'),
  ('nav.logout', 'Log Out', 'ออกจากระบบ'),
  
  -- My QR Code Page
  ('qr_page.header', 'My JOKO QR Code 🎫', 'QR โค้ด JOKO ของฉัน 🎫'),
  ('qr_page.subtitle', 'Your digital ID with JOKO TODAY', 'บัตรประจำตัวดิจิทัลของคุณกับ JOKO TODAY'),
  ('qr_page.intro', 'This is your personal JOKO TODAY QR code.', 'นี่คือ QR โค้ด JOKO TODAY ส่วนตัวของคุณ'),
  ('qr_page.usage', 'Use it for easy login and always show it when picking up your goodies 🥐', 'ใช้สำหรับเข้าสู่ระบบง่ายและแสดงทุกครั้งที่มารับของอร่อย 🥐'),
  ('qr_page.staff_info', 'Our staff will scan this code to instantly see your order and take care of the rest.', 'พนักงานของเราจะสแกนโค้ดนี้เพื่อดูออเดอร์ของคุณและดูแลส่วนที่เหลือ'),
  ('qr_page.save_button', '✔ Save on your phone', '✔ บันทึกในโทรศัพท์'),
  ('qr_page.always_here', 'You can always find this QR again in your account.', 'คุณสามารถหา QR นี้ได้ทุกเวลาในบัญชีของคุณ'),
  
  -- My Profile Page - Headers
  ('profile_page.header', 'My Profile ☀️', 'โปรไฟล์ของฉัน ☀️'),
  ('profile_page.subtitle', 'Your details help us prepare your orders and stay in touch.', 'รายละเอียดของคุณช่วยเราเตรียมออเดอร์และติดต่อคุณ'),
  
  -- My Profile Page - Personal Info Section
  ('profile_page.personal_info', 'Personal Information', 'ข้อมูลส่วนตัว'),
  ('profile_page.avatar_label', 'Profile Picture', 'รูปโปรไฟล์'),
  ('profile_page.upload_photo', 'Upload Photo', 'อัปโหลดรูปภาพ'),
  ('profile_page.name_label', 'Name / Nickname', 'ชื่อ / ชื่อเล่น'),
  ('profile_page.phone_label', 'Phone Number', 'หมายเลขโทรศัพท์'),
  ('profile_page.email_label', 'Email Address', 'อีเมล'),
  ('profile_page.email_readonly', '(verified, cannot be changed here)', '(ยืนยันแล้ว ไม่สามารถเปลี่ยนได้ที่นี่)'),
  
  -- My Profile Page - Contact Methods
  ('profile_page.contact_methods', 'Contact Methods', 'ช่องทางติดต่อ'),
  ('profile_page.contact_help', 'How can we reach you with order updates?', 'เราจะติดต่อคุณเกี่ยวกับออเดอร์ได้อย่างไร?'),
  ('profile_page.line_label', 'LINE ID', 'ไลน์ไอดี'),
  ('profile_page.whatsapp_label', 'WhatsApp', 'วอทส์แอพ'),
  ('profile_page.wechat_label', 'WeChat ID', 'วีแชทไอดี'),
  
  -- My Profile Page - Preferences
  ('profile_page.preferences', 'Preferences', 'การตั้งค่า'),
  ('profile_page.pickup_location', 'Preferred Pickup Location', 'สถานที่รับสินค้าที่ต้องการ'),
  ('profile_page.language_pref', 'Language Preference', 'ภาษาที่ต้องการ'),
  ('profile_page.language_en', 'English', 'อังกฤษ'),
  ('profile_page.language_th', 'ไทย', 'ไทย'),
  
  -- My Profile Page - Security Section
  ('profile_page.security', 'Security 🔐', 'ความปลอดภัย 🔐'),
  ('profile_page.change_password', 'Change Password', 'เปลี่ยนรหัสผ่าน'),
  ('profile_page.current_password', 'Current Password', 'รหัสผ่านปัจจุบัน'),
  ('profile_page.new_password', 'New Password', 'รหัสผ่านใหม่'),
  ('profile_page.confirm_password', 'Confirm New Password', 'ยืนยันรหัสผ่านใหม่'),
  ('profile_page.update_password_button', 'Update Password', 'อัปเดตรหัสผ่าน'),
  
  -- My Profile Page - Buttons
  ('profile_page.save_changes', '✔ Save Changes', '✔ บันทึกการเปลี่ยนแปลง'),
  ('profile_page.view_qr', '✔ View My QR Code', '✔ ดู QR โค้ดของฉัน'),
  ('profile_page.saving', 'Saving...', 'กำลังบันทึก...'),
  ('profile_page.saved', 'Changes saved!', 'บันทึกแล้ว!'),
  
  -- My Orders Page - Headers
  ('orders_page.header', 'My Orders 📦', 'ออเดอร์ของฉัน 📦'),
  ('orders_page.current_tab', '🟢 Current Orders', '🟢 ออเดอร์ปัจจุบัน'),
  ('orders_page.past_tab', '🟤 Past Orders', '🟤 ออเดอร์ที่ผ่านมา'),
  
  -- My Orders Page - Current Orders
  ('orders_page.goodies_coming', 'Your goodies are on the way 🥐', 'ของอร่อยของคุณกำลังมา 🥐'),
  ('orders_page.no_current', 'No current orders', 'ไม่มีออเดอร์ปัจจุบัน'),
  ('orders_page.no_current_text', 'Ready to order some delicious treats?', 'พร้อมสั่งขนมอร่อยๆ หรือยัง?'),
  ('orders_page.start_shopping', 'Start Shopping', 'เริ่มช้อปปิ้ง'),
  
  -- My Orders Page - Order Card
  ('orders_page.order_number', 'Order #', 'ออเดอร์ #'),
  ('orders_page.pickup_day', 'Pickup Day', 'วันที่รับ'),
  ('orders_page.pickup_location', 'Location', 'สถานที่'),
  ('orders_page.items_summary', 'Items', 'รายการ'),
  ('orders_page.total', 'Total', 'ยอดรวม'),
  ('orders_page.payment_status', 'Payment', 'การชำระเงิน'),
  ('orders_page.paid', 'Paid ✓', 'จ่ายแล้ว ✓'),
  ('orders_page.pay_at_pickup', 'Pay at pickup', 'จ่ายตอนรับ'),
  
  -- My Orders Page - Order Status
  ('orders_page.status_pending', 'Pending', 'รอดำเนินการ'),
  ('orders_page.status_confirmed', 'Confirmed ✓', 'ยืนยันแล้ว ✓'),
  ('orders_page.status_ready', 'Ready for pickup! 🎉', 'พร้อมรับแล้ว! 🎉'),
  ('orders_page.status_picked_up', 'Picked up', 'รับแล้ว'),
  ('orders_page.status_cancelled', 'Cancelled', 'ยกเลิกแล้ว'),
  
  -- My Orders Page - Actions
  ('orders_page.edit_order', 'Edit Order', 'แก้ไขออเดอร์'),
  ('orders_page.cancel_order', 'Cancel Order', 'ยกเลิกออเดอร์'),
  ('orders_page.reorder', 'Reorder', 'สั่งอีกครั้ง'),
  ('orders_page.view_details', 'View Details', 'ดูรายละเอียด'),
  
  -- My Orders Page - Past Orders
  ('orders_page.past_favorites', 'Your past favorites', 'ของโปรดในอดีต'),
  ('orders_page.no_past', 'No past orders yet', 'ยังไม่มีออเดอร์ที่ผ่านมา'),
  ('orders_page.no_past_text', 'Your order history will appear here once you make your first order.', 'ประวัติออเดอร์จะแสดงที่นี่เมื่อคุณสั่งซื้อครั้งแรก'),
  
  -- General Messages
  ('general.success', 'Success!', 'สำเร็จ!'),
  ('general.error', 'Oops! Something went wrong', 'อุ๊ย! มีบางอย่างผิดพลาด'),
  ('general.confirm', 'Are you sure?', 'คุณแน่ใจหรือไม่?'),
  ('general.cancel', 'Cancel', 'ยกเลิก'),
  ('general.confirm_action', 'Confirm', 'ยืนยัน'),
  ('general.loading', 'Loading...', 'กำลังโหลด...')
ON CONFLICT (key) DO UPDATE SET
  text_en = EXCLUDED.text_en,
  text_th = EXCLUDED.text_th,
  updated_at = now();
