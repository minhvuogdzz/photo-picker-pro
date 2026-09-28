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

console.log(`Generating updater latest.json for tag ${tag}...`);
const releaseJson = execSync(`gh release view ${tag} --json tagName,publishedAt,assets`).toString();
const release = JSON.parse(releaseJson);

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

const version = tag.replace(/^v/, "");
const platforms = {};

// macOS aarch64
const macArmAsset = findAsset(/aarch64.*\.app\.tar\.gz$/);
const macArmSig = readSig(/aarch64.*\.app\.tar\.gz\.sig$/);
if (macArmAsset && macArmSig) {
  platforms["darwin-aarch64"] = { signature: macArmSig, url: macArmAsset.url };
  platforms["darwin-aarch64-app"] = { signature: macArmSig, url: macArmAsset.url };
}

// macOS x86_64
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
  notes: `MVD Tech & Design Studio ${tag}`,
  pub_date: release.publishedAt || new Date().toISOString(),
  platforms,
};

const outPath = "./latest.json";
fs.writeFileSync(outPath, JSON.stringify(updaterJson, null, 2));
console.log("Generated latest.json:\n", JSON.stringify(updaterJson, null, 2));
execSync(`gh release upload ${tag} "${outPath}" --clobber`);
console.log(`Successfully uploaded latest.json to release ${tag}!`);

// Cleanup
fs.rmSync(sigDir, { recursive: true, force: true });
fs.rmSync(outPath, { force: true });
