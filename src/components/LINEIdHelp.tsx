import type { Language } from '../translations';

export function LINEIdHelp({ language, id }: { language: Language; id: string }) {
  return <p id={id} className="mt-1 text-xs text-gray-500">
    {language === 'th'
      ? 'LINE ID ส่วนตัว: ไม่ต้องใส่ @ (เช่น somchai_123) หากเป็น ID บัญชีทางการที่ขึ้นต้นด้วย @ ให้ใส่ @ ด้วย (เช่น @yourshop) ช่องนี้ใช้สำหรับติดต่อ ไม่ได้เชื่อมต่อ LINE Login'
      : language === 'zh'
        ? '个人 LINE ID：不加 @（例如 somchai_123）。官方账号 ID 如以 @ 开头，请保留 @（例如 @yourshop）。此栏仅用于联系，不会关联 LINE 登录。'
        : 'Personal LINE ID: enter without @ (e.g. somchai_123). For an Official Account ID that starts with @, keep it (e.g. @yourshop). This is a contact detail; it does not connect LINE login.'}
  </p>;
}
