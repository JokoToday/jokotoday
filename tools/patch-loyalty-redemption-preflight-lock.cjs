const fs = require('fs');

function replaceExactly(text, needle, replacement, label) {
  const count = text.split(needle).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return text.replace(needle, replacement);
}

const sqlPath = 'supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql';
let sql = fs.readFileSync(sqlPath, 'utf8');
sql = replaceExactly(
  sql,
  'LOCK TABLE public.loyalty_redemptions IN SHARE MODE;\n\nDO $\nDECLARE',
  'LOCK TABLE public.loyalty_redemptions IN SHARE MODE;\n\nDO $$\nDECLARE',
  'SQL dollar-quote opener'
);
fs.writeFileSync(sqlPath, sql);

const walkInPath = 'src/pages/WalkInDeskPage.tsx';
let walkIn = fs.readFileSync(walkInPath, 'utf8');
walkIn = replaceExactly(
  walkIn,
  `onClick={() => {\n                              setPaymentMethod('qr_code');\n                              setError(null);\n                              purchaseReferenceRef.current = null;\n                              purchaseRequestKeyRef.current = null;\n                            }}`,
  `onClick={() => {\n                              setPaymentMethod('qr_code');\n                              setError(null);\n                            }}`,
  'Walk-In QR payment handler'
);
walkIn = replaceExactly(
  walkIn,
  `onClick={() => {\n                              setPaymentMethod('cash');\n                              setError(null);\n                              purchaseReferenceRef.current = null;\n                              purchaseRequestKeyRef.current = null;\n                            }}`,
  `onClick={() => {\n                              setPaymentMethod('cash');\n                              setError(null);\n                            }}`,
  'Walk-In cash payment handler'
);
walkIn = replaceExactly(
  walkIn,
  `onChange={(rewardId) => {\n                          setSelectedRewardId(rewardId);\n                          setError(null);\n                          purchaseReferenceRef.current = null;\n                          purchaseRequestKeyRef.current = null;\n                        }}`,
  `onChange={(rewardId) => {\n                          setSelectedRewardId(rewardId);\n                          setError(null);\n                        }}`,
  'Walk-In reward selector handler'
);
fs.writeFileSync(walkInPath, walkIn);

for (const helper of [
  'tools/patch-loyalty-v2-final-p1.cjs',
  '.github/workflows/loyalty-v2-final-p1-once.yml',
]) {
  if (fs.existsSync(helper)) fs.unlinkSync(helper);
}
