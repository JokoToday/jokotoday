/*
  # Seed CMS labels for auth_required_modal namespace

  ## Summary
  Adds all multilingual CMS labels needed by the AuthRequiredModal component.

  ## New Labels (namespace: auth_required_modal)
  - title: Modal heading text
  - body: Introductory paragraph
  - benefit_1: First bullet point benefit
  - benefit_2: Second bullet point benefit
  - benefit_3: Third bullet point benefit
  - sign_in_button: Primary CTA button label
  - create_account_button: Secondary CTA button label
  - footer_text: Footer note about Magic Link delivery
  - email_label: Email input field label
  - email_placeholder: Email input placeholder
  - send_link_button: Submit button inside the email form
  - sending_label: Loading state text
  - email_sent_title: Success state heading
  - email_sent_body: Success state body copy

  ## Languages: en, th, zh
*/

INSERT INTO cms_labels (key, text_en, text_th, text_zh)
VALUES
  ('auth_required_modal.title',              'Sign In to Continue',                                'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ',       '请登录以继续'),
  ('auth_required_modal.body',               'To place an order at JOKO TODAY, please sign in or create an account.',  'หากต้องการสั่งซื้อกับ JOKO TODAY กรุณาเข้าสู่ระบบหรือสมัครสมาชิกก่อน',  '如需在 JOKO TODAY 下单，请先登录或创建账户。'),
  ('auth_required_modal.benefit_1',          'Track your orders',                                  'ตรวจสอบคำสั่งซื้อ',                        '查看订单状态'),
  ('auth_required_modal.benefit_2',          'Access your member QR code',                         'เข้าถึง QR Code สมาชิก',                   '使用会员二维码'),
  ('auth_required_modal.benefit_3',          'Enjoy a seamless boutique experience',               'รับประสบการณ์การใช้งานที่ราบรื่น',         '享受流畅的精品购物体验'),
  ('auth_required_modal.sign_in_button',     'Sign In',                                            'เข้าสู่ระบบ',                              '登录'),
  ('auth_required_modal.create_account_button', 'Create Account',                                  'สมัครสมาชิก',                              '创建账户'),
  ('auth_required_modal.footer_text',        'You will receive a secure Magic Link via email.',    'คุณจะได้รับลิงก์เข้าสู่ระบบทางอีเมล',     '您将通过电子邮件收到安全登录链接。'),
  ('auth_required_modal.email_label',        'Email Address',                                      'อีเมล',                                    '电子邮件'),
  ('auth_required_modal.email_placeholder',  'you@example.com',                                   'you@example.com',                           'you@example.com'),
  ('auth_required_modal.send_link_button',   'Send Magic Link',                                   'ส่งลิงก์เข้าสู่ระบบ',                      '发送登录链接'),
  ('auth_required_modal.sending_label',      'Sending…',                                          'กำลังส่ง…',                                 '发送中…'),
  ('auth_required_modal.email_sent_title',   'Check your inbox',                                  'ตรวจสอบอีเมลของคุณ',                        '请查收邮件'),
  ('auth_required_modal.email_sent_body',    'We sent a secure sign-in link to your email address. Click the link to continue.',  'เราได้ส่งลิงก์เข้าสู่ระบบไปยังอีเมลของคุณ กรุณาคลิกลิงก์เพื่อดำเนินการต่อ',  '我们已向您的邮箱发送了安全登录链接，请点击链接继续。'),
  ('auth_required_modal.having_account_title', 'Having an account allows you to:',               'การมีบัญชีผู้ใช้ช่วยให้คุณ:',              '拥有账户后，您可以：'),
  ('auth_required_modal.back_button',        'Back',                                              'กลับ',                                      '返回')
ON CONFLICT (key) DO UPDATE
  SET text_en = EXCLUDED.text_en,
      text_th = EXCLUDED.text_th,
      text_zh = EXCLUDED.text_zh;
