/*
  # Add Auth Microcopy CMS Labels

  1. Overview
    - Adds warm, bakery-style microcopy for authentication and onboarding flows
    - All text is bilingual (EN/TH) and editable via CMS
    - Tone: warm, local bakery, friendly, not corporate

  2. New Labels
    - Auth modal: welcome headers, button text, helpers
    - Profile completion: warm instructions, field labels
    - QR success: friendly explanation of QR system for pickup/loyalty
    - Checkout gate: welcoming auth prompts
    - General helpers: form placeholders, validation messages

  3. Design Notes
    - Microcopy emphasizes community, warmth, and personal touch
    - Uses conversational language ("we", "you", "your")
    - Explains benefits clearly without being corporate
*/

-- Insert warm, bakery-style auth microcopy
INSERT INTO cms_labels (key, text_en, text_th) VALUES
  -- Auth Modal - Welcome & Headers
  ('auth.welcome_back', 'Welcome back!', 'ยินดีต้อนรับกลับมา!'),
  ('auth.join_us', 'Join the JOKO family', 'เข้าร่วมครอบครัว JOKO'),
  ('auth.signin_header', 'Hey there!', 'สวัสดีค่ะ!'),
  ('auth.signup_header', 'Let''s get you started', 'มาเริ่มกันเลย'),
  
  -- Auth Modal - Descriptions
  ('auth.signin_subtitle', 'Sign in to place your order and earn loyalty rewards', 'เข้าสู่ระบบเพื่อสั่งซื้อและรับคะแนนสะสม'),
  ('auth.signup_subtitle', 'Create an account to order your favorite baked goods', 'สร้างบัญชีเพื่อสั่งขนมอบโปรดของคุณ'),
  
  -- Auth Modal - Method Selection
  ('auth.choose_method', 'How would you like to sign in?', 'คุณต้องการเข้าสู่ระบบด้วยวิธีใด?'),
  ('auth.password_method', 'Email & Password', 'อีเมลและรหัสผ่าน'),
  ('auth.magiclink_method', 'Magic Link', 'ลิงก์มหัศจรรย์'),
  
  -- Auth Modal - Form Fields
  ('auth.email_label', 'Your email', 'อีเมลของคุณ'),
  ('auth.email_placeholder', 'hello@example.com', 'hello@example.com'),
  ('auth.password_label', 'Password', 'รหัสผ่าน'),
  ('auth.password_placeholder', 'At least 6 characters', 'อย่างน้อย 6 ตัวอักษร'),
  ('auth.password_hint', 'Minimum 6 characters', 'อย่างน้อย 6 ตัวอักษร'),
  
  -- Auth Modal - Buttons
  ('auth.signin_button', 'Sign In', 'เข้าสู่ระบบ'),
  ('auth.signup_button', 'Create Account', 'สร้างบัญชี'),
  ('auth.send_magiclink_button', 'Send Magic Link', 'ส่งลิงก์มหัศจรรย์'),
  ('auth.loading', 'Just a moment...', 'รอสักครู่...'),
  
  -- Auth Modal - Magic Link
  ('auth.magiclink_sent', '✨ Magic link sent! Check your email inbox.', '✨ ส่งลิงก์แล้ว! กรุณาตรวจสอบอีเมลของคุณ'),
  ('auth.magiclink_info', 'We''ll email you a secure link to sign in—no password needed', 'เราจะส่งลิงก์ปลอดภัยให้คุณ ไม่ต้องใช้รหัสผ่าน'),
  
  -- Auth Modal - Toggles
  ('auth.no_account', 'New here?', 'มาใหม่ใช่ไหม?'),
  ('auth.have_account', 'Already have an account?', 'มีบัญชีอยู่แล้ว?'),
  ('auth.create_account_link', 'Create one', 'สร้างบัญชี'),
  ('auth.signin_link', 'Sign in', 'เข้าสู่ระบบ'),
  
  -- Profile Completion - Headers
  ('profile.welcome_header', 'Great! Just a few quick details...', 'ยอดเยี่ยม! เหลือรายละเอียดนิดหน่อย...'),
  ('profile.completion_subtitle', 'This helps us stay in touch about your orders and rewards', 'ช่วยเราติดต่อคุณเกี่ยวกับออเดอร์และรางวัล'),
  
  -- Profile Completion - Field Labels
  ('profile.name_label', 'What should we call you?', 'เราควรเรียกคุณว่าอะไร?'),
  ('profile.name_placeholder', 'Your name or nickname', 'ชื่อหรือชื่อเล่นของคุณ'),
  ('profile.name_hint', 'First name or nickname is perfect!', 'ใช้ชื่อจริงหรือชื่อเล่นก็ได้!'),
  
  ('profile.phone_label', 'Your phone number', 'หมายเลขโทรศัพท์ของคุณ'),
  ('profile.phone_placeholder', '0812345678', '0812345678'),
  ('profile.phone_hint', 'We''ll text you order updates', 'เราจะส่งข้อความแจ้งสถานะออเดอร์'),
  
  -- Profile Completion - Contact Method
  ('profile.contact_header', 'How can we reach you?', 'เราติดต่อคุณได้ทางไหน?'),
  ('profile.contact_subtitle', 'Pick at least one so we can send order updates', 'เลือกอย่างน้อย 1 ช่องทางเพื่อแจ้งข้อมูลออเดอร์'),
  ('profile.line_placeholder', 'Your LINE ID', 'ไลน์ไอดีของคุณ'),
  ('profile.whatsapp_placeholder', 'Your WhatsApp number', 'หมายเลขวอทส์แอพ'),
  ('profile.wechat_placeholder', 'Your WeChat ID', 'วีแชทไอดีของคุณ'),
  
  -- Profile Completion - Buttons & Validation
  ('profile.save_button', 'All set! Continue', 'เรียบร้อย! ดำเนินการต่อ'),
  ('profile.saving', 'Saving...', 'กำลังบันทึก...'),
  ('profile.name_required_error', 'We need a name to greet you by!', 'เราต้องการชื่อเพื่อเรียกคุณ!'),
  ('profile.phone_required_error', 'Phone number helps us reach you', 'หมายเลขโทรศัพท์ช่วยให้เราติดต่อคุณได้'),
  ('profile.contact_required_error', 'Please add at least one contact method', 'กรุณาเพิ่มช่องทางติดต่ออย่างน้อย 1 ช่องทาง'),
  
  -- QR Code Success - Headers
  ('qr.success_header', 'You''re all set! 🎉', 'เรียบร้อยแล้ว! 🎉'),
  ('qr.loyalty_card_title', 'Your Personal Loyalty Card', 'บัตรสะสมคะแนนของคุณ'),
  
  -- QR Code Success - Explanation
  ('qr.what_is_this', 'What''s this QR code for?', 'QR โค้ดนี้ใช้ทำอะไร?'),
  ('qr.benefit_1_title', '📦 Easy pickup', '📦 รับสินค้าง่าย'),
  ('qr.benefit_1_text', 'Show this when picking up your order—no need to remember order numbers!', 'แสดง QR นี้ตอนมารับสินค้า ไม่ต้องจำหมายเลขออเดอร์!'),
  ('qr.benefit_2_title', '⭐ Loyalty rewards', '⭐ คะแนนสะสม'),
  ('qr.benefit_2_text', 'We''ll scan it each visit to track your rewards and special offers', 'เราจะสแกนทุกครั้งที่คุณมารับเพื่อสะสมคะแนนและรับข้อเสนอพิเศษ'),
  ('qr.benefit_3_title', '💝 Personal touch', '💝 บริการส่วนตัว'),
  ('qr.benefit_3_text', 'Helps us remember your favorites and surprise you with treats!', 'ช่วยเราจดจำของโปรดของคุณและมอบของขวัญพิเศษ!'),
  
  -- QR Code Success - Instructions
  ('qr.save_instruction', 'Save this QR code to your phone', 'บันทึก QR โค้ดนี้ลงในโทรศัพท์'),
  ('qr.save_button', '📥 Save to Photos', '📥 บันทึกลงรูปภาพ'),
  ('qr.view_anytime', 'You can view it anytime in your account', 'คุณสามารถดูได้ทุกเวลาในบัญชีของคุณ'),
  ('qr.done_button', 'Got it! Let''s shop', 'เข้าใจแล้ว! ไปช้อปปิ้งกันเลย'),
  
  -- Checkout Gate - Headers
  ('checkout.gate_header', 'Almost there!', 'เกือบเสร็จแล้ว!'),
  ('checkout.gate_subtitle', 'Sign in to complete your order and save your favorites', 'เข้าสู่ระบบเพื่อสั่งซื้อและบันทึกของโปรด'),
  ('checkout.gate_benefits_title', 'Why create an account?', 'ทำไมต้องสร้างบัญชี?'),
  ('checkout.gate_benefit_1', '✓ Track your orders easily', '✓ ติดตามออเดอร์ได้ง่าย'),
  ('checkout.gate_benefit_2', '✓ Earn loyalty rewards', '✓ สะสมคะแนน'),
  ('checkout.gate_benefit_3', '✓ Faster checkout next time', '✓ สั่งซื้อเร็วขึ้นครั้งหน้า'),
  
  -- Checkout Gate - Buttons
  ('checkout.signin_to_continue', 'Sign In', 'เข้าสู่ระบบ'),
  ('checkout.create_account_button', 'Create Account', 'สร้างบัญชี'),
  ('checkout.back_to_shopping', 'Keep Shopping', 'ช้อปปิ้งต่อ'),
  
  -- General Messages
  ('general.required_field', 'This field is required', 'กรุณากรอกข้อมูลนี้'),
  ('general.optional', '(optional)', '(ไม่บังคับ)')
ON CONFLICT (key) DO UPDATE SET
  text_en = EXCLUDED.text_en,
  text_th = EXCLUDED.text_th,
  updated_at = now();
