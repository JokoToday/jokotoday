from pathlib import Path

path = Path('scripts/patch-loyalty-walkin-payment-method.py')
text = path.read_text()
old = '''def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 exact match, found {count}")
    return text.replace(old, new, 1)
'''
new = '''def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    expected = 2 if label in {
        'walkin fast idempotency payment method',
        'walkin fast replay payment method response',
    } else 1
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} exact match(es), found {count}")
    return text.replace(old, new, 1)
'''
if text.count(old) != 1:
    raise SystemExit('patch helper definition changed unexpectedly')
path.write_text(text.replace(old, new, 1))
