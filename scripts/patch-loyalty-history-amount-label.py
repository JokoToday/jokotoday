from pathlib import Path

path = Path('src/components/staff/CustomerPurchaseHistory.tsx')
text = path.read_text()
old = """                                  <span className=\"text-sm font-semibold text-gray-700\">{language === 'en' ? 'Total paid' : 'ยอดชำระจริง'}</span>
                                  <span className=\"text-base font-bold text-gray-900\">฿{money(orderPaidAmount(order))}</span>"""
new = """                                  <span className=\"text-sm font-semibold text-gray-700\">
                                    {order.payment_status === 'paid'
                                      ? (language === 'en' ? 'Total paid' : 'ยอดชำระจริง')
                                      : (language === 'en' ? 'Amount due' : 'ยอดที่ต้องชำระ')}
                                  </span>
                                  <span className=\"text-base font-bold text-gray-900\">฿{money(orderPaidAmount(order))}</span>"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected 1 exact history total label match, found {count}')
path.write_text(text.replace(old, new, 1))
