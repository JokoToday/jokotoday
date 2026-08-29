/*
  # Fill Chinese (Simplified) content across all CMS sections

  ## Overview
  Populates text_zh / name_zh / desc_zh / title_zh / description_zh columns
  for all records that currently have NULL Chinese values, using translations
  that already exist in the frontend translations.ts file.

  ## Sections updated
  1. cms_products   – name_zh, desc_zh  (9 products)
  2. cms_categories – title_zh, description_zh  (4 categories)
  3. cms_labels     – text_zh  (all labels with matching zh keys)

  ## Notes
  - Pickup locations already have zh content from a previous migration
  - Only sets values where they are currently NULL to avoid overwriting manual edits
*/

-- ============================================================
-- 1. PRODUCTS
-- ============================================================
UPDATE cms_products SET
  name_zh = '巧克力可颂',
  desc_zh = '黄油可颂内馅浓郁黑巧克力，早餐或任何时候的完美选择。'
WHERE slug = 'chocolate-croissant' AND name_zh IS NULL;

UPDATE cms_products SET
  name_zh = '酸面包',
  desc_zh = '手工酸面包，口感微酸，内芯有嚼劲，最适合做三明治或烤面包片。'
WHERE slug = 'sourdough-loaf' AND name_zh IS NULL;

UPDATE cms_products SET
  name_zh = '巧克力蛋糕',
  desc_zh = '浓郁湿润的巧克力蛋糕，配上丝滑巧克力甘纳许，巧克力爱好者的梦想。'
WHERE slug = 'chocolate-cake' AND name_zh IS NULL;

UPDATE cms_products SET
  name_zh = '菠菜芝士法式咸派',
  desc_zh = '咸香法式咸派，内馅新鲜菠菜、芝士和奶油，早午餐的完美选择。'
WHERE slug = 'spinach-quiche' AND name_zh IS NULL;

UPDATE cms_products SET
  name_zh = '蘑菇披萨',
  desc_zh = '手工披萨，配新鲜蘑菇、芝士和香草，素食者的最爱。'
WHERE slug = 'mushroom-pizza' AND name_zh IS NULL;

UPDATE cms_products SET
  name_zh = '草莓奶油蛋糕',
  desc_zh = '轻盈的海绵蛋糕，夹层为新鲜草莓和鲜奶油。'
WHERE slug = 'strawberry-shortcake' AND name_zh IS NULL;

UPDATE cms_products SET
  name_zh = '原味可颂',
  desc_zh = '经典全黄油可颂，层次分明，酥脆轻盈，经典中的经典。'
WHERE slug = 'plain-croissant' AND name_zh IS NULL;

UPDATE cms_products SET
  name_zh = '杂粮面包',
  desc_zh = '饱满的多谷物面包，富含各种种子和全谷物，营养又美味。'
WHERE slug = 'multigrain-bread' AND name_zh IS NULL;

UPDATE cms_products SET
  name_zh = '杏仁可颂',
  desc_zh = '表面撒有杏仁片和淡淡杏仁奶油，坚果香浓郁。'
WHERE slug = 'almond-croissant' AND name_zh IS NULL;

-- ============================================================
-- 2. CATEGORIES
-- ============================================================
UPDATE cms_categories SET
  title_zh = '可颂与酥点',
  description_zh = '传统工艺，层层酥香，满满黄油香气。'
WHERE slug = 'croissants' AND title_zh IS NULL;

UPDATE cms_categories SET
  title_zh = '面包',
  description_zh = '优质原料，新鲜出炉的手工面包。'
WHERE slug = 'breads' AND title_zh IS NULL;

UPDATE cms_categories SET
  title_zh = '蛋糕与饼干',
  description_zh = '庆祝时刻或午后茶点的甜蜜选择。'
WHERE slug = 'cakes' AND title_zh IS NULL;

UPDATE cms_categories SET
  title_zh = '法式咸派、披萨等',
  description_zh = '包括各式面包、法式咸派和手工披萨。'
WHERE slug = 'quiche' AND title_zh IS NULL;

-- ============================================================
-- 3. LABELS
-- ============================================================
UPDATE cms_labels SET text_zh = '加入购物车'      WHERE key = 'btn_add_to_cart'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '浏览产品'        WHERE key = 'btn_browse_products'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '购物车是空的'    WHERE key = 'cart_empty'                 AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '已售罄'          WHERE key = 'label_sold_out'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '立即订购'        WHERE key = 'order_button'               AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '取货地点'        WHERE key = 'pickup_label'               AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '价格'            WHERE key = 'price_label'                AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '数量'            WHERE key = 'quantity_label'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '合计'            WHERE key = 'total_label'                AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '结账'            WHERE key = 'checkout_title'             AND text_zh IS NULL;

-- auth labels
UPDATE cms_labels SET text_zh = '您想如何登录？'          WHERE key = 'auth.choose_method'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '创建一个'                WHERE key = 'auth.create_account_link'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的邮箱'                WHERE key = 'auth.email_label'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = 'hello@example.com'       WHERE key = 'auth.email_placeholder'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '已有账户？'              WHERE key = 'auth.have_account'          AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '加入 JOKO 大家庭'        WHERE key = 'auth.join_us'               AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '稍等片刻...'             WHERE key = 'auth.loading'               AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我们将发送安全链接，无需密码即可登录' WHERE key = 'auth.magiclink_info' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '魔法链接'                WHERE key = 'auth.magiclink_method'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '✨ 魔法链接已发送！请查收邮件。' WHERE key = 'auth.magiclink_sent' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '新用户？'                WHERE key = 'auth.no_account'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '最少6个字符'             WHERE key = 'auth.password_hint'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '密码'                    WHERE key = 'auth.password_label'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '邮箱与密码'              WHERE key = 'auth.password_method'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '至少6个字符'             WHERE key = 'auth.password_placeholder'  AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '发送魔法链接'            WHERE key = 'auth.send_magiclink_button' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '登录'                    WHERE key = 'auth.signin_button'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '欢迎回来！'              WHERE key = 'auth.signin_header'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '登录'                    WHERE key = 'auth.signin_link'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '登录以下单并赚取积分奖励'  WHERE key = 'auth.signin_subtitle'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '创建账户'                WHERE key = 'auth.signup_button'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '开始吧'                  WHERE key = 'auth.signup_header'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '创建账户以订购您喜爱的烘焙产品' WHERE key = 'auth.signup_subtitle' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '欢迎回来！'              WHERE key = 'auth.welcome_back'          AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '登录 / 注册'             WHERE key = 'nav.signin_signup'          AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '退出登录'                WHERE key = 'nav.logout'                 AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我的订单'                WHERE key = 'nav.my_orders'              AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我的资料'                WHERE key = 'nav.my_profile'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我的二维码'              WHERE key = 'nav.my_qr'                  AND text_zh IS NULL;

-- general labels
UPDATE cms_labels SET text_zh = '取消'                    WHERE key = 'general.cancel'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您确定吗？'              WHERE key = 'general.confirm'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '确认'                    WHERE key = 'general.confirm_action'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '出了点问题'              WHERE key = 'general.error'              AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '加载中...'               WHERE key = 'general.loading'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '（可选）'                WHERE key = 'general.optional'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '此项必填'                WHERE key = 'general.required_field'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '成功！'                  WHERE key = 'general.success'            AND text_zh IS NULL;

-- checkout labels
UPDATE cms_labels SET text_zh = '继续购物'                WHERE key = 'checkout.back_to_shopping'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '创建账户'                WHERE key = 'checkout.create_account_button' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '✓ 轻松追踪订单'          WHERE key = 'checkout.gate_benefit_1'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '✓ 赚取积分奖励'          WHERE key = 'checkout.gate_benefit_2'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '✓ 下次结账更快'          WHERE key = 'checkout.gate_benefit_3'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '为什么要创建账户？'       WHERE key = 'checkout.gate_benefits_title'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '快完成了！'              WHERE key = 'checkout.gate_header'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '登录以完成订单并收藏商品' WHERE key = 'checkout.gate_subtitle'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '登录'                    WHERE key = 'checkout.signin_to_continue'    AND text_zh IS NULL;

-- celebration labels
UPDATE cms_labels SET text_zh = '关闭'                    WHERE key = 'celebration.dismiss_button'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '前往我的资料'            WHERE key = 'celebration.go_profile_button'  AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '这是您快速取货和登录的通行证。' WHERE key = 'celebration.qr_description' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的专属二维码已准备好。' WHERE key = 'celebration.qr_ready'          AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '保存二维码到手机'        WHERE key = 'celebration.save_qr_button'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '3个简单步骤'             WHERE key = 'celebration.steps_title'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '欢迎来到 JOKO TODAY！'   WHERE key = 'celebration.welcome_header'     AND text_zh IS NULL;

-- orders page labels
UPDATE cms_labels SET text_zh = '取消订单'                WHERE key = 'orders_page.cancel_order'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '🟢 当前订单'             WHERE key = 'orders_page.current_tab'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '编辑订单'                WHERE key = 'orders_page.edit_order'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的商品正在路上 🥐'     WHERE key = 'orders_page.goodies_coming'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我的订单 📦'             WHERE key = 'orders_page.header'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '到店购买'                WHERE key = 'orders_page.in_store_label'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '🏪 到店购买'             WHERE key = 'orders_page.in_store_tab'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '商品'                    WHERE key = 'orders_page.items_summary'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '暂无当前订单'            WHERE key = 'orders_page.no_current'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '准备好订购美味了吗？'    WHERE key = 'orders_page.no_current_text'    AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '暂无到店购买记录'        WHERE key = 'orders_page.no_in_store'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '暂无历史订单'            WHERE key = 'orders_page.no_past'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的首次订单完成后，订单历史将显示在这里。' WHERE key = 'orders_page.no_past_text' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '🛍 在线订单'             WHERE key = 'orders_page.online_tab'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '订单 #'                  WHERE key = 'orders_page.order_number'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '已付款 ✓'               WHERE key = 'orders_page.paid'               AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的历史收藏'            WHERE key = 'orders_page.past_favorites'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '🟤 历史订单'             WHERE key = 'orders_page.past_tab'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '取货时付款'              WHERE key = 'orders_page.pay_at_pickup'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '付款'                    WHERE key = 'orders_page.payment_status'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '取货日期'                WHERE key = 'orders_page.pickup_day'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '地点'                    WHERE key = 'orders_page.pickup_location'    AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '重新订购'                WHERE key = 'orders_page.reorder'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '开始购物'                WHERE key = 'orders_page.start_shopping'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '已取消'                  WHERE key = 'orders_page.status_cancelled'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '已确认 ✓'               WHERE key = 'orders_page.status_confirmed'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '待处理'                  WHERE key = 'orders_page.status_pending'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '已取货'                  WHERE key = 'orders_page.status_picked_up'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '准备取货！🎉'            WHERE key = 'orders_page.status_ready'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '合计'                    WHERE key = 'orders_page.total'              AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '查看详情'                WHERE key = 'orders_page.view_details'       AND text_zh IS NULL;

-- profile page labels
UPDATE cms_labels SET text_zh = '头像'                    WHERE key = 'profile_page.avatar_label'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '更改密码'                WHERE key = 'profile_page.change_password'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '确认新密码'              WHERE key = 'profile_page.confirm_password'  AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我们如何联系您更新订单？' WHERE key = 'profile_page.contact_help'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '联系方式'                WHERE key = 'profile_page.contact_methods'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '当前密码'                WHERE key = 'profile_page.current_password'  AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '电子邮箱地址'            WHERE key = 'profile_page.email_label'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '（已验证，此处不可更改）' WHERE key = 'profile_page.email_readonly'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我的资料 ☀️'            WHERE key = 'profile_page.header'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = 'English'                 WHERE key = 'profile_page.language_en'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '语言偏好'                WHERE key = 'profile_page.language_pref'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = 'ไทย'                    WHERE key = 'profile_page.language_th'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = 'LINE ID'                 WHERE key = 'profile_page.line_label'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '姓名 / 昵称'             WHERE key = 'profile_page.name_label'        AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '新密码'                  WHERE key = 'profile_page.new_password'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '个人信息'                WHERE key = 'profile_page.personal_info'     AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '电话号码'                WHERE key = 'profile_page.phone_label'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '首选取货地点'            WHERE key = 'profile_page.pickup_location'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '偏好设置'                WHERE key = 'profile_page.preferences'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '✔ 保存更改'              WHERE key = 'profile_page.save_changes'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '更改已保存！'            WHERE key = 'profile_page.saved'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '保存中...'               WHERE key = 'profile_page.saving'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '安全 🔐'                 WHERE key = 'profile_page.security'          AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的详细信息帮助我们准备订单并与您保持联系。' WHERE key = 'profile_page.subtitle' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '更新密码'                WHERE key = 'profile_page.update_password_button' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '上传照片'                WHERE key = 'profile_page.upload_photo'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '✔ 查看我的二维码'        WHERE key = 'profile_page.view_qr'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '微信 ID'                 WHERE key = 'profile_page.wechat_label'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = 'WhatsApp'                WHERE key = 'profile_page.whatsapp_label'    AND text_zh IS NULL;

-- profile completion modal labels
UPDATE cms_labels SET text_zh = '这帮助我们与您保持订单和奖励的联系'  WHERE key = 'profile.completion_subtitle' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我们怎么联系您？'         WHERE key = 'profile.contact_header'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '请至少添加一种联系方式'   WHERE key = 'profile.contact_required_error' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '请选择至少一种，以便我们发送订单更新' WHERE key = 'profile.contact_subtitle' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的 LINE ID'             WHERE key = 'profile.line_placeholder'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '名字或昵称最合适！'       WHERE key = 'profile.name_hint'              AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我们怎么称呼您？'         WHERE key = 'profile.name_label'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的姓名或昵称'           WHERE key = 'profile.name_placeholder'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我们需要一个称呼您的名字！' WHERE key = 'profile.name_required_error'  AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我们会发短信通知您订单更新' WHERE key = 'profile.phone_hint'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的电话号码'             WHERE key = 'profile.phone_label'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '0812345678'              WHERE key = 'profile.phone_placeholder'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '电话号码帮助我们联系您'   WHERE key = 'profile.phone_required_error'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '好了！继续'              WHERE key = 'profile.save_button'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '保存中...'               WHERE key = 'profile.saving'                  AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的微信 ID'             WHERE key = 'profile.wechat_placeholder'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '太棒了！请填写几个快速信息...' WHERE key = 'profile.welcome_header'   AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的 WhatsApp 号码'       WHERE key = 'profile.whatsapp_placeholder'   AND text_zh IS NULL;

-- QR page labels
UPDATE cms_labels SET text_zh = '您随时可以在账户中找到这个二维码。'     WHERE key = 'qr_page.always_here'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您可以保存到手机，或打印成小卡放在钱包里。' WHERE key = 'qr_page.card_info'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '下载为卡片'                             WHERE key = 'qr_page.download_card_button'  AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '下载为图片'                             WHERE key = 'qr_page.download_image_button' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我的 JOKO 二维码 🎫'                   WHERE key = 'qr_page.header'                AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '这是您的 JOKO TODAY 专属二维码。'      WHERE key = 'qr_page.intro'                 AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '✔ 保存到手机'                          WHERE key = 'qr_page.save_button'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '我们的工作人员将扫描此码，立即查看您的订单并处理后续事宜。' WHERE key = 'qr_page.staff_info' AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您在 JOKO TODAY 的数字身份'            WHERE key = 'qr_page.subtitle'              AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '取货时请出示，轻松登录 🥐'             WHERE key = 'qr_page.usage'                 AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '取货时出示——无需记住订单号！'          WHERE key = 'qr.benefit_1_text'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '📦 轻松取货'                           WHERE key = 'qr.benefit_1_title'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '每次来店我们都会扫码，追踪您的奖励和特惠' WHERE key = 'qr.benefit_2_text'          AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '⭐ 积分奖励'                           WHERE key = 'qr.benefit_2_title'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '帮助我们记住您的最爱，给您带来惊喜！'  WHERE key = 'qr.benefit_3_text'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '💝 个性化服务'                         WHERE key = 'qr.benefit_3_title'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '明白了！去购物'                        WHERE key = 'qr.done_button'                AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您的专属积分卡'                        WHERE key = 'qr.loyalty_card_title'         AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '📥 保存到相册'                         WHERE key = 'qr.save_button'                AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '保存此二维码到手机'                     WHERE key = 'qr.save_instruction'           AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '一切就绪！🎉'                          WHERE key = 'qr.success_header'             AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '您随时可以在账户中查看'                 WHERE key = 'qr.view_anytime'               AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '这个二维码是用来做什么的？'             WHERE key = 'qr.what_is_this'               AND text_zh IS NULL;

-- walk-in desk labels
UPDATE cms_labels SET text_zh = '输入付款金额（到店购买）'              WHERE key = 'walk_in_desk.enter_amount'      AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '到店服务台'                            WHERE key = 'walk_in_desk.header'            AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '到店购买无商品明细'                    WHERE key = 'walk_in_desk.no_items'          AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '保存到店购买记录'                      WHERE key = 'walk_in_desk.save_button'       AND text_zh IS NULL;
UPDATE cms_labels SET text_zh = '记录现有会员的到店购买'                WHERE key = 'walk_in_desk.subtitle'          AND text_zh IS NULL;
