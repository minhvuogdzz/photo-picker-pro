import { execSync } from "child_process";
import fs from "fs";

let tag = process.argv[2] || process.env.GITHUB_REF_NAME;
if (!tag || !tag.startsWith("v")) {
  try {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    tag = `v${pkg.version}`;
  } catch {
    console.error("No valid tag or version found");
    process.exit(1);
  }
}

const version = tag.replace(/^v/, "");
console.log(`Generating updater latest.json for tag ${tag} (version ${version})...`);

const releaseJson = execSync(`gh release view ${tag} --json tagName,publishedAt,body,assets`).toString();
const release = JSON.parse(releaseJson);

/**
 * Trích xuất nội dung Release Notes chi tiết & chuyên nghiệp:
 * 1. Đọc từ file CHANGELOG.md theo phiên bản
 * 2. Đọc từ Git Tag Annotation (nếu có nội dung)
 * 3. Đọc từ GitHub Release body (nếu không phải chuỗi mặc định)
 * 4. Fallback nội dung chuẩn mực chuyên nghiệp
 */
function getReleaseNotes() {
  // 1. Kiểm tra trong CHANGELOG.md
  if (fs.existsSync("CHANGELOG.md")) {
    const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
    const escapedVersion = version.replace(/\./g, "\\.");
    const regex = new RegExp(`##\\s*\\[?v?${escapedVersion}\\]?[^\\n]*\\n([\\s\\S]*?)(?=\\n---\\s*\\n|\\n##\\s*\\[|$)`, "i");
    const match = changelog.match(regex);
    if (match && match[1]?.trim()) {
      return match[1].trim().replace(/\n---\s*$/, "").trim();
    }
  }

  // 2. Kiểm tra từ Git Tag Annotation
  try {
    const tagMessage = execSync(`git tag -l --format="%(contents)" ${tag}`).toString().trim();
    if (tagMessage && tagMessage.length > 15 && !tagMessage.startsWith("v")) {
      return tagMessage;
    }
  } catch {
    // Bỏ qua lỗi nếu git clone nông
  }

  // 3. Kiểm tra GitHub Release body
  if (release.body && release.body.trim() && !release.body.includes("See the assets to download")) {
    return release.body.trim();
  }

  // 4. Mẫu chuẩn mặc định
  return `### Trong bản cập nhật ${tag} này, chúng tôi đã:\n\n- Tối ưu hóa hiệu suất xử lý và nâng cao tính ổn định của hệ thống.\n- Cải thiện trải nghiệm giao diện người dùng và quy trình làm việc studio.`;
}

const releaseNotes = getReleaseNotes();

// Nếu GitHub Release đang mang body mặc định, cập nhật ngay bằng nội dung chi tiết
if (!release.body || release.body.includes("See the assets to download")) {
  try {
    const tempNotesPath = "./.release-notes-temp.md";
    fs.writeFileSync(tempNotesPath, releaseNotes);
    execSync(`gh release edit ${tag} --notes-file "${tempNotesPath}"`);
    fs.rmSync(tempNotesPath, { force: true });
    console.log(`Đã cập nhật Release Notes chi tiết lên GitHub Release ${tag}!`);
  } catch (err) {
    console.warn("Không thể cập nhật GitHub release body qua gh CLI:", err.message);
  }
}

// Download all .sig files into a local temporary folder
const sigDir = "./.updater-sigs";
fs.mkdirSync(sigDir, { recursive: true });
execSync(`gh release download ${tag} -p "*.sig" -D "${sigDir}" --clobber`);

const findAsset = (pattern) => release.assets.find((a) => pattern.test(a.name));
const readSig = (pattern) => {
  const asset = findAsset(pattern);
  if (!asset) return null;
  const filePath = `${sigDir}/${asset.name}`;
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8").trim();
  }
  return null;
};

const platforms = {};

// macOS aarch64 (Apple Silicon)
const macArmAsset = findAsset(/aarch64.*\.app\.tar\.gz$/);
const macArmSig = readSig(/aarch64.*\.app\.tar\.gz\.sig$/);
if (macArmAsset && macArmSig) {
  platforms["darwin-aarch64"] = { signature: macArmSig, url: macArmAsset.url };
  platforms["darwin-aarch64-app"] = { signature: macArmSig, url: macArmAsset.url };
}

// macOS x86_64 (Intel)
const macX64Asset = findAsset(/x64.*\.app\.tar\.gz$/);
const macX64Sig = readSig(/x64.*\.app\.tar\.gz\.sig$/);
if (macX64Asset && macX64Sig) {
  platforms["darwin-x86_64"] = { signature: macX64Sig, url: macX64Asset.url };
  platforms["darwin-x86_64-app"] = { signature: macX64Sig, url: macX64Asset.url };
}

// Windows x86_64 nsis zip
const winZipAsset = findAsset(/x64.*\.nsis\.zip$/);
const winZipSig = readSig(/x64.*\.nsis\.zip\.sig$/);
if (winZipAsset && winZipSig) {
  platforms["windows-x86_64"] = { signature: winZipSig, url: winZipAsset.url };
}

// Windows x86_64 setup exe
const winExeAsset = findAsset(/x64-setup\.exe$/);
const winExeSig = readSig(/x64-setup\.exe\.sig$/);
if (winExeAsset && winExeSig) {
  platforms["windows-x86_64-nsis"] = { signature: winExeSig, url: winExeAsset.url };
}

const updaterJson = {
  version,
  notes: releaseNotes,
  pub_date: release.publishedAt || new Date().toISOString(),
  platforms,
};

const outPath = "./latest.json";
fs.writeFileSync(outPath, JSON.stringify(updaterJson, null, 2));
console.log("Generated latest.json with detailed notes:\n", JSON.stringify(updaterJson, null, 2));
execSync(`gh release upload ${tag} "${outPath}" --clobber`);
console.log(`Successfully uploaded latest.json to release ${tag}!`);

// Cleanup
fs.rmSync(sigDir, { recursive: true, force: true });
fs.rmSync(outPath, { force: true });
