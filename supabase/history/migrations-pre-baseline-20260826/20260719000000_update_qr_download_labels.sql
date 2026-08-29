UPDATE cms_labels
SET
  text_en = 'Download Membership Card',
  text_th = 'ดาวน์โหลดบัตรสมาชิก',
  text_zh = '下载会员卡'
WHERE key = 'qr_page.download_card_button';

UPDATE cms_labels
SET
  text_en = 'Download QR Image',
  text_th = 'ดาวน์โหลดรูป QR',
  text_zh = '下载二维码图片'
WHERE key = 'qr_page.download_image_button';
