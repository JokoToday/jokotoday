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
text = text.replace(old, new, 1)

old_anchor = '''anchor = """-- A paid discounted pickup order must preserve the exact net amount paid.\n"""'''
new_anchor = '''anchor = """-- Any paid discounted order created after this rollout must record exact net paid.\n"""'''
if text.count(old_anchor) != 1:
    raise SystemExit('audit anchor definition changed unexpectedly')
text = text.replace(old_anchor, new_anchor, 1)

old_trailing = '''-- A paid discounted pickup order must preserve the exact net amount paid.\n"""'''
new_trailing = '''-- Any paid discounted order created after this rollout must record exact net paid.\n"""'''
if text.count(old_trailing) != 1:
    raise SystemExit('audit insertion trailing comment changed unexpectedly')
text = text.replace(old_trailing, new_trailing, 1)

path.write_text(text)
