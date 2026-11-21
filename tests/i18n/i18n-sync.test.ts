import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  translations,
  translate,
  trText,
  getCurrentLanguage,
  getLocaleCode,
  localizeBackendMessage,
} from "../../src/core/lib/i18n.ts";
import { useSettingsStore } from "../../src/core/stores/useSettingsStore.ts";

const VIETNAMESE_CHAR_REGEX =
  /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/;

// Domain data tokens used strictly for Google Sheet column matching / status comparisons
// (never UI copy — these must remain Vietnamese so actual studio Sheets keep working).
const DOMAIN_DATA_TOKENS = new Set([
  "đã lọc",
  "chưa lọc",
  "Chưa lọc",
  "Đã lọc",
  "Đang lọc",
  "Chờ lọc",
  "Chưa chụp",
  "Đang xử lý",
  "Chưa sửa",
  "DS Khách",
  "Vương",
  "cọ",
  "giáo trình",
  "tài liệu",
  "Tiếng Việt",
  "Tiếng Việt (Mặc định)",
]);

function walkTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsxFiles(full, out);
    } else if (entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function getLineCol(sf: ts.SourceFile, pos: number): { line: number; col: number } {
  const lc = sf.getLineAndCharacterOfPosition(pos);
  return { line: lc.line + 1, col: lc.character + 1 };
}

function isInsideCallNamed(node: ts.Node, names: Set<string>): { call: ts.CallExpression; argIndex: number } | null {
  let curr: ts.Node | undefined = node;
  while (curr && curr.parent) {
    if (ts.isCallExpression(curr.parent)) {
      const call = curr.parent;
      const expr = call.expression;
      const calleeName = ts.isIdentifier(expr)
        ? expr.text
        : ts.isPropertyAccessExpression(expr)
          ? expr.name.text
          : null;
      if (calleeName && names.has(calleeName)) {
        const argIndex = call.arguments.findIndex((arg) => arg === curr || (curr!.pos >= arg.pos && curr!.end <= arg.end));
        if (argIndex >= 0) {
          return { call, argIndex };
        }
      }
    }
    curr = curr.parent;
  }
  return null;
}

function isConsoleCall(node: ts.Node): boolean {
  let curr: ts.Node | undefined = node;
  while (curr) {
    if (ts.isCallExpression(curr) && ts.isPropertyAccessExpression(curr.expression)) {
      const obj = curr.expression.expression;
      if (ts.isIdentifier(obj) && obj.text === "console") {
        return true;
      }
    }
    curr = curr.parent;
  }
  return false;
}

function isTagsArrayLiteral(node: ts.Node): boolean {
  let curr: ts.Node | undefined = node.parent;
  if (curr && ts.isArrayLiteralExpression(curr)) {
    const parent = curr.parent;
    if (parent && ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name) && parent.name.text === "tags") {
      return true;
    }
  }
  return false;
}

function isDomainDataContext(node: ts.Node, text: string): boolean {
  if (DOMAIN_DATA_TOKENS.has(text.trim()) || isTagsArrayLiteral(node)) {
    return true;
  }
  // Allow string literals inside `.includes("...")` / `=== "..."` / `!== "..."` for sheet status checks
  const p = node.parent;
  if (p && ts.isBinaryExpression(p) && (p.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken || p.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)) {
    if (DOMAIN_DATA_TOKENS.has(text.trim())) return true;
  }
  return false;
}

test("i18n dictionary: vi and en keys match 100% with no Vietnamese leaked into en", () => {
  const enKeys = Object.keys(translations.en).sort();
  const viKeys = Object.keys(translations.vi).sort();

  assert.deepEqual(enKeys, viKeys, "translations.en and translations.vi must have identical keys");

  for (const key of enKeys) {
    const enVal = translations.en[key as keyof typeof translations.en];
    const viVal = translations.vi[key as keyof typeof translations.vi];
    assert.ok(enVal && enVal.trim().length > 0, `translations.en.${key} must not be empty`);
    assert.ok(viVal && viVal.trim().length > 0, `translations.vi.${key} must not be empty`);

    if (key !== "vietnamese") {
      assert.equal(
        VIETNAMESE_CHAR_REGEX.test(enVal),
        false,
        `translations.en.${key} contains Vietnamese characters: "${enVal}"`
      );
    }
  }
});

test("i18n runtime helpers switch cleanly between vi and en", () => {
  const prevLang = useSettingsStore.getState().settings.language;
  try {
    useSettingsStore.getState().setLanguageLocal("en");
    assert.equal(getCurrentLanguage(), "en");
    assert.equal(getLocaleCode(), "en-US");
    assert.equal(translate("scan_match"), "Scan & Match");
    assert.equal(trText("Xin chào", "Hello"), "Hello");
    assert.equal(localizeBackendMessage("Đã quét 120 file ảnh..."), "Scanned 120 image files...");
    assert.equal(
      localizeBackendMessage("Đang lọc 5/20 file"),
      "Processing 5/20 files"
    );

    useSettingsStore.getState().setLanguageLocal("vi");
    assert.equal(getCurrentLanguage(), "vi");
    assert.equal(getLocaleCode(), "vi-VN");
    assert.equal(translate("scan_match"), "Quét file");
    assert.equal(trText("Xin chào", "Hello"), "Xin chào");
    assert.equal(localizeBackendMessage("Đã quét 120 file ảnh..."), "Đã quét 120 file ảnh...");
  } finally {
    useSettingsStore.getState().setLanguageLocal(prevLang);
  }
});

test("i18n AST audit: zero unwrapped Vietnamese UI strings in src/**/*.tsx", () => {
  const srcRoot = path.resolve(process.cwd(), "src");
  const files = walkTsxFiles(srcRoot).sort();
  const violations: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const rel = path.relative(process.cwd(), file);
    const sf = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const visit = (node: ts.Node) => {
      // 1. Validate tr(vi, en) / trText(vi, en) calls
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        const name = ts.isIdentifier(expr)
          ? expr.text
          : ts.isPropertyAccessExpression(expr)
            ? expr.name.text
            : null;
        if (name === "tr" || name === "trText") {
          const { line } = getLineCol(sf, node.getStart(sf));
          if (node.arguments.length < 2) {
            violations.push(`${rel}:${line}: ${name}() must receive both (vi, en) arguments`);
          } else {
            const enArg = node.arguments[1];
            const checkEnNode = (n: ts.Node) => {
              if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
                if (VIETNAMESE_CHAR_REGEX.test(n.text) && !DOMAIN_DATA_TOKENS.has(n.text.trim())) {
                  violations.push(`${rel}:${line}: English argument of ${name}() contains Vietnamese: "${n.text}"`);
                }
              } else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
                if (VIETNAMESE_CHAR_REGEX.test(n.text) && !DOMAIN_DATA_TOKENS.has(n.text.trim())) {
                  violations.push(`${rel}:${line}: English template of ${name}() contains Vietnamese: "${n.text}"`);
                }
              }
              ts.forEachChild(n, checkEnNode);
            };
            checkEnNode(enArg);
          }
          return;
        }
      }

      // 2. Skip console.* logs and regex literals
      if (ts.isRegularExpressionLiteral(node) || isConsoleCall(node)) {
        return;
      }

      // 3. Flag unwrapped Vietnamese text in JSX or string/template literals
      let textToCheck: string | null = null;
      if (ts.isJsxText(node)) {
        textToCheck = node.getText(sf);
      } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        textToCheck = node.text;
      } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        textToCheck = node.text;
      }

      if (textToCheck && VIETNAMESE_CHAR_REGEX.test(textToCheck)) {
        // Ignore if inside tr() / trText() (already handled above)
        if (isInsideCallNamed(node, new Set(["tr", "trText"]))) {
          return;
        }
        // Ignore if inside type alias / interface property or import path
        if (ts.isImportDeclaration(node.parent)) {
          return;
        }
        if (isDomainDataContext(node, textToCheck)) {
          return;
        }
        const { line } = getLineCol(sf, node.getStart(sf));
        const snippet = textToCheck.trim().replace(/\s+/g, " ").slice(0, 70);
        violations.push(`${rel}:${line}: Unwrapped Vietnamese UI string "${snippet}"`);
      }

      ts.forEachChild(node, visit);
    };

    visit(sf);
  }

  assert.equal(
    violations.length,
    0,
    `Found ${violations.length} i18n violations:\n${violations.slice(0, 80).join("\n")}${violations.length > 80 ? `\n...and ${violations.length - 80} more` : ""}`
  );
});
