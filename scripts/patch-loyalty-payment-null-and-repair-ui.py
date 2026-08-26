from pathlib import Path

# SQL: all three staff payment-method entry points must reject NULL explicitly.
path = Path('supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql')
text = path.read_text()
old = """  IF p_payment_method NOT IN ('cash', 'qr_code') THEN
    RAISE EXCEPTION 'Payment method must be cash or qr_code';
  END IF;"""
new = """  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'qr_code') THEN
    RAISE EXCEPTION 'Payment method must be cash or qr_code';
  END IF;"""
count = text.count(old)
if count != 2:
    raise SystemExit(f'expected 2 generic payment-method guards, found {count}')
text = text.replace(old, new)

old = """  IF p_payment_method NOT IN ('cash', 'qr_code') THEN
    RAISE EXCEPTION 'Walk-in payment method must be cash or qr_code';
  END IF;"""
new = """  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'qr_code') THEN
    RAISE EXCEPTION 'Walk-in payment method must be cash or qr_code';
  END IF;"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected 1 Walk-In payment-method guard, found {count}')
text = text.replace(old, new, 1)
path.write_text(text)

# UI: a repair action is only meaningful for already-paid completed orders that
# are missing a valid payment method. Historical unpaid completed orders require
# separate reconciliation rather than an action that the RPC intentionally rejects.
path = Path('src/components/staff/CustomerPurchaseHistory.tsx')
text = path.read_text()
old = """                    const paymentComplete = order.payment_status === 'paid' && Boolean(order.payment_method);"""
new = """                    const paymentComplete = order.payment_status === 'paid'
                      && ['cash', 'qr_code', 'qr'].includes(order.payment_method ?? '');"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected 1 paymentComplete definition, found {count}')
text = text.replace(old, new, 1)

old = """                            {!isCancelled && !paymentComplete && ['picked_up', 'completed'].includes(order.status) && ("""
new = """                            {!isCancelled && order.payment_status === 'paid' && !paymentComplete && ['picked_up', 'completed'].includes(order.status) && ("""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected 1 payment repair eligibility condition, found {count}')
text = text.replace(old, new, 1)
path.write_text(text)
