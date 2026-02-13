import test from 'node:test';
import assert from 'node:assert/strict';
import { getRiskBannerCopy, normalizeRiskCopyVariant, resolveRiskCopyVariant } from '../utils/riskBannerCopy.js';

test('normalizeRiskCopyVariant accepts only serious/friendly', () => {
  assert.equal(normalizeRiskCopyVariant('serious'), 'serious');
  assert.equal(normalizeRiskCopyVariant('friendly'), 'friendly');
  assert.equal(normalizeRiskCopyVariant('abc'), null);
});

test('resolveRiskCopyVariant prefers query over storage', () => {
  assert.equal(resolveRiskCopyVariant({ queryValue: 'friendly', storedValue: 'serious' }), 'friendly');
  assert.equal(resolveRiskCopyVariant({ queryValue: 'bad', storedValue: 'friendly' }), 'friendly');
  assert.equal(resolveRiskCopyVariant({ queryValue: null, storedValue: null }), 'serious');
});

test('getRiskBannerCopy returns distinct copy blocks', () => {
  const serious = getRiskBannerCopy('serious');
  const friendly = getRiskBannerCopy('friendly');

  assert.notEqual(serious.title, friendly.title);
  assert.notEqual(serious.description, friendly.description);
  assert.equal(serious.badges.length > 0, true);
  assert.equal(friendly.badges.length > 0, true);
});
