// Type-check the actual intent request against the pinned Stripe SDK contract.
// No Stripe credentials, network calls or payment creation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const sdk = process.env.STRIPE_MODULE;
assert.ok(sdk, 'Set STRIPE_MODULE to the isolated Stripe 22.6.0 ESM entrypoint');
const raw = await readFile('supabase/functions/stripe-promptpay-intent/index.ts','utf8');
const source = ts.createSourceFile('intent.ts', raw, ts.ScriptTarget.Latest, true);
let argument;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'stripe.paymentIntents.create') argument = node.arguments[0].getText(source);
  ts.forEachChild(node, visit);
}
visit(source); assert.ok(argument, 'Actual intent creation request found');
const virtualFile = '/tmp/specials-stripe-sdk-contract.mts';
const code = `import Stripe from ${JSON.stringify(sdk)};
const amount=40,billingEmail='synthetic@example.invalid';
const order={order_number:'TEST',id:'order'};
const payment={id:'transaction'};
const request: Stripe.PaymentIntentCreateParams = ${argument};
void request;`;
const options = { noEmit:true, strict:true, skipLibCheck:true, target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.NodeNext, moduleResolution:ts.ModuleResolutionKind.NodeNext };
const host = ts.createCompilerHost(options);
const originalGetSource = host.getSourceFile.bind(host);
host.getSourceFile = (path, version, ...rest) => path === virtualFile ? ts.createSourceFile(path, code, version, true) : originalGetSource(path, version, ...rest);
const program = ts.createProgram([virtualFile], options, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
console.log('PASS: actual PaymentIntent creation request matches Stripe SDK types; allowed_payment_method_types is supported');
