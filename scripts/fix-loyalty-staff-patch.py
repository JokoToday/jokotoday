from pathlib import Path

path = Path('scripts/patch-loyalty-staff-ui.py')
text = path.read_text()
old = '''text = replace_once(
    text,
    "    setPurchaseResult(null);\\n    purchaseReferenceRef.current = null;",
    "    setPurchaseResult(null);\\n    setSelectedRewardId('');\\n    purchaseReferenceRef.current = null;\\n    purchaseRequestKeyRef.current = null;",
    'walkin clear state',
)
'''
new = '''text = text.replace(
    "    setPurchaseResult(null);\\n    purchaseReferenceRef.current = null;",
    "    setPurchaseResult(null);\\n    setSelectedRewardId('');\\n    purchaseReferenceRef.current = null;\\n    purchaseRequestKeyRef.current = null;",
    1,
)
'''
if text.count(old) != 1:
    raise SystemExit(f'expected one clear-state patch block, found {text.count(old)}')
path.write_text(text.replace(old, new, 1))
