const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/print-pricing.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText, { exports: exportsForTest });
const { parsePrintPrice, createPricingDraft, parsePricingDraft } = exportsForTest;

test('prices retain exact cents including values vulnerable to floating point truncation', () => {
  for (const [input, cents] of [['0', 0], ['0.01', 1], ['12.3', 1230], ['19.99', 1999], ['1.15', 115], ['1000000', 100000000]]) {
    assert.equal(parsePrintPrice(input), cents);
  }
});

test('incomplete, negative, excessive precision and non-finite inputs cannot become saved prices', () => {
  for (const input of ['', ' ', '.', '12.', '-1', '0.001', '1e3', 'Infinity', 'NaN', '1000000.01', '99999999999999999']) {
    assert.equal(parsePrintPrice(input), null, input);
  }
});

test('missing price combinations and an empty configuration cannot be saved', () => {
  const draft = { 'pla-single': { '5x5x5': '10.00' } };
  assert.equal(parsePricingDraft(draft, ['pla-single'], ['5x5x5', '10x10x10']), null);
  assert.equal(parsePricingDraft(draft, ['pla-single', 'resin'], ['5x5x5']), null);
  assert.equal(parsePricingDraft({}, [], []), null);
});

test('loaded prices round-trip, and invalid edits do not change the saved configuration', () => {
  const saved = { 'pla-single': { '5x5x5': 1999, '10x10x10': 0 }, resin: { '5x5x5': 2500, '10x10x10': 4567 } };
  const draft = createPricingDraft(saved);
  assert.equal(JSON.stringify(parsePricingDraft(draft, ['pla-single', 'resin'], ['5x5x5', '10x10x10'])), JSON.stringify(saved));
  draft.resin['10x10x10'] = '';
  assert.equal(parsePricingDraft(draft, ['pla-single', 'resin'], ['5x5x5', '10x10x10']), null);
  assert.equal(saved.resin['10x10x10'], 4567);
});
