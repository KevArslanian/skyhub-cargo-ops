import assert from "node:assert/strict";
import {
  composePublicAwb,
  extractPublicAwbSuffix,
  formatAwbInput,
  formatPublicAwbSuffixInput,
  sanitizeCommodityText,
  sanitizeDecimalInput,
  sanitizePersonName,
} from "../src/lib/input-guards";

assert.equal(sanitizePersonName("John123"), "John");
assert.equal(formatAwbInput("abc12345678901"), "123-45678901");
assert.equal(formatPublicAwbSuffixInput("abc10000001xyz"), "10000001");
assert.equal(composePublicAwb("10000001"), "160-10000001");
assert.equal(extractPublicAwbSuffix("160-10000012"), "10000012");
assert.equal(sanitizeDecimalInput("12.5kg"), "12.5");
assert.equal(sanitizeCommodityText("Kargo123"), "Kargo");

console.log(JSON.stringify({ ok: true, checks: 7 }));