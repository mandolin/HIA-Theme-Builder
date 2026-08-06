// @lang zh-CN 跨端 scanner bundle 同源一致性校验：Electron 注入、Tauri include_str! 与 extractor 权威源
//   必须指向/内容等于同一份 `browser-scanner.bundle.js`，保证三端算法一致与评分可复现。
//   失败即提示未同步（需 `npm install` / robocopy 将 extractor/dist 同步到 electron 的 node_modules 副本）。
// @lang en Cross-end scanner bundle parity check: Electron injection, Tauri include_str!, and the extractor source
//   must all resolve to/equal the same `browser-scanner.bundle.js`, guaranteeing identical algorithms and reproducible scoring.
//   Failure indicates unsynced copies (run `npm install` / robocopy to sync extractor/dist into electron's node_modules).

import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 仓库根推断：本脚本位于 HIA/extractor/scripts/，故根 = ../../../。
// <lang zh-CN>相对路径解析，避免硬编码绝对路径。</lang>
// <lang en>Resolve relative to repo root; avoid hard-coded absolute paths.</lang>
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");

// 权威源：extractor 编译产物（IIFE，三端共用）。
// <lang zh-CN>以此为唯一事实来源。</lang>
// <lang en>The single source of truth.</lang>
const sourcePath = join(repoRoot, "HIA", "extractor", "dist", "browser-scanner.bundle.js");

// Electron 运行期实际读取：node_modules 中 @hia/theme-url-extractor 的 dist 副本（file: 链接 + 复制同步）。
// <lang zh-CN>render-adapter.ts 中 join(__dirname,'..','node_modules','@hia','theme-url-extractor','dist',...) 对应此路径。</lang>
// <lang en>Matches render-adapter.ts: join(__dirname,'..','node_modules','@hia','theme-url-extractor','dist',...).</lang>
const electronPkgRoot = join(repoRoot, "HIA", "electron", "node_modules", "@hia", "theme-url-extractor");
const electronPath = join(electronPkgRoot, "dist", "browser-scanner.bundle.js");

// Tauri 编译期嵌入：render.rs 中 include_str!("../../../extractor/dist/browser-scanner.bundle.js")。
// <lang zh-CN>解析字面量路径，相对 render.rs 所在目录。</lang>
// <lang en>Parse the literal path relative to render.rs directory.</lang>
const renderRsPath = join(repoRoot, "HIA", "tauri", "src-tauri", "src", "render.rs");
const tauriPath = (() => {
  const src = readFileSync(renderRsPath, "utf8");
  const m = src.match(/include_str!\(\s*"([^"]+)"\s*\)/);
  if (!m) throw new Error(`未在 ${renderRsPath} 找到 include_str! 字面量`);
  return resolve(dirname(renderRsPath), m[1]);
})();

function sha256(p) {
  const buf = readFileSync(p);
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

function load(name, p) {
  if (!existsSync(p)) {
    return { name, path: p, ok: false, reason: "文件不存在（未同步）" };
  }
  return { name, path: p, ok: true, hash: sha256(p) };
}

const checks = [
  load("extractor(权威源)", sourcePath),
  load("electron(node_modules副本)", electronPath),
  load("tauri(include_str!)", tauriPath),
];

let failed = false;
console.log("=== 跨端 scanner bundle 同源一致性校验 ===");
for (const c of checks) {
  if (!c.ok) {
    failed = true;
    console.log(`[FAIL] ${c.name}\n      路径: ${c.path}\n      原因: ${c.reason}`);
  } else {
    console.log(`[ OK ] ${c.name}\n      路径: ${c.path}\n      sha256: ${c.hash}`);
  }
}

// 比对内容：electron/tauri 必须等于权威源（以内容 hash 为准，允许不同文件名但内容相同）。
// <lang zh-CN>若 node_modules 副本缺失则上面已标记失败。</lang>
// <lang en>Missing node_modules copy already flagged above.</lang>
if (!failed) {
  const srcHash = checks[0].hash;
  for (const c of checks.slice(1)) {
    if (c.hash !== srcHash) {
      failed = true;
      console.log(`[FAIL] ${c.name} 内容 hash 与权威源不一致（${c.hash} != ${srcHash}）`);
    }
  }
}

if (failed) {
  console.log("\n结论: 不一致。请同步 extractor/dist 到 electron 的 node_modules 副本（如 robocopy /MIR），并确认 tauri include_str! 指向 extractor/dist。");
  process.exit(1);
}
console.log("\n结论: 三端 scanner bundle 内容一致，算法同源。");
process.exit(0);
