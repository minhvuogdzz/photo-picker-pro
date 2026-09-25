import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanCodeToken, formatPastedCodes, isCommandToken } from "../../src/modules/photo-picker/utils/codeFormatter.ts";

describe("Photo Picker Code Formatter & Prefix Reset Commands", () => {
  it("recognizes command tokens", () => {
    assert.strictEqual(isCommandToken("@clear"), true);
    assert.strictEqual(isCommandToken("@none"), true);
    assert.strictEqual(isCommandToken("#none"), true);
    assert.strictEqual(isCommandToken("#clear"), true);
    assert.strictEqual(isCommandToken("clear"), true);
    assert.strictEqual(isCommandToken("none"), true);
    assert.strictEqual(isCommandToken("@reset"), true);
    assert.strictEqual(isCommandToken("@all"), true);
    assert.strictEqual(isCommandToken("IGM0088"), false);
    assert.strictEqual(isCommandToken("IMG0138"), false);
  });

  it("cleanCodeToken preserves @clear and normalizes command tokens", () => {
    assert.strictEqual(cleanCodeToken("@clear"), "@clear");
    assert.strictEqual(cleanCodeToken("@none"), "@none");
    assert.strictEqual(cleanCodeToken("clear"), "@clear");
    assert.strictEqual(cleanCodeToken("none"), "@none");
    assert.strictEqual(cleanCodeToken("#none"), "@none");
    assert.strictEqual(cleanCodeToken("  @clear:  "), "@clear");
  });

  it("cleanCodeToken still cleans regular codes and preserves file extensions", () => {
    assert.strictEqual(cleanCodeToken("+IMG01234"), "IMG01234");
    assert.strictEqual(cleanCodeToken("ABC1234.JPG"), "ABC1234.JPG");
    assert.strictEqual(cleanCodeToken("_MG_1234.CR2"), "_MG_1234.CR2");
  });

  it("formatPastedCodes correctly preserves @clear with list of codes", () => {
    const input = `@clear

IGM0088
IMG0138
IMG0175
IMG0309
IMG0528
IMG0561`;

    const expected = `@clear
IGM0088
IMG0138
IMG0175
IMG0309
IMG0528
IMG0561`;

    assert.strictEqual(formatPastedCodes(input), expected);
  });

  it("formatPastedCodes converts bare clear or none to @clear / @none", () => {
    const input = `clear
IGM0088
IMG0138`;

    const expected = `@clear
IGM0088
IMG0138`;

    assert.strictEqual(formatPastedCodes(input), expected);
  });
});
