/**
 * @lang zh-CN 导出适配器单测（`ADR-005` / `W-tb-P9`）：文件树完整性、可复现性、WP theme.json Schema 式断言、
 *   Tailwind config 可解析性、ADR-004 自定义色阶贯通与字体/间距令牌透传。
 * @lang en Export-adapter tests (`ADR-005` / `W-tb-P9`): file-tree completeness, reproducibility, WP theme.json
 *   schema-style assertions, Tailwind config parseability, ADR-004 custom-shade propagation and typography/spacing passthrough.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTheme, GRADIENT_DEFAULTS, listExportTargets, getExportTarget,
  wordpressChildTarget, tailwindConfigTarget, injectTemplateTarget
} from '../dist/index.js';

/** @lang zh-CN 基准主题（含引用自定义档 650 的渐变，验证 ADR-004 贯通）。 @lang en Base theme (with a gradient referencing custom shade 650, verifying ADR-004 propagation). */
const THEME = buildTheme({
  name: '钴蓝示例 Cobalt Demo', category: 'demo', industry: 'tech',
  primary: '#0047AB', secondary: '#00A8D3', primaryName: '钴蓝', secondaryName: '清透青',
  gradients: {
    ...GRADIENT_DEFAULTS,
    carousel: { enabled: true, family: 'primary', start: '650', end: '300', direction: '135deg', bias: 'front75' }
  },
  typography: { fontFamily: { body: "system-ui,'Segoe UI',sans-serif", heading: 'Georgia,serif', mono: 'monospace' }, fontSizeScale: { base: 16, ratio: 1.25 }, lineHeightBody: 1.6 },
  spacing: { base: 8, step: 'x2', levels: 6 }
});

/** @lang zh-CN 取 WP 产物中 theme.json 的解析对象。 @lang en Parse theme.json from the WP artifacts. */
function wpThemeJson(theme = THEME) {
  const files = wordpressChildTarget.files(theme);
  const themeJson = files.find(f => f.path === 'theme.json');
  assert.ok(themeJson, 'theme.json 应存在');
  return JSON.parse(themeJson.content);
}

/** @lang zh-CN 取 Tailwind config 的求值结果（CommonJS 沙箱）。 @lang en Evaluate the Tailwind config in a CommonJS sandbox. */
function tailwindConfig(theme = THEME) {
  const files = tailwindConfigTarget.files(theme);
  const config = files.find(f => f.path === 'tailwind.config.js');
  assert.ok(config, 'tailwind.config.js 应存在');
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', config.content + '\n;return module.exports;');
  return fn(mod, mod.exports);
}

test('注册表: 三个内置目标可检索且 id 唯一（registry lookup）', () => {
  const targets = listExportTargets();
  assert.equal(targets.length, 3);
  assert.deepEqual(targets.map(t => t.id), ['wordpress-child', 'tailwind-config', 'css-inject']);
  assert.ok(getExportTarget('tailwind-config'), '按 id 检索命中');
  assert.equal(getExportTarget('nope'), undefined, '未知 id 返回 undefined');
});

test('文件树完整性: WP 四件套 / Tailwind 两件 / 注入模板两件（file tree completeness）', () => {
  assert.deepEqual(wordpressChildTarget.files(THEME).map(f => f.path),
    ['style.css', 'theme.json', 'functions.php', 'readme.txt']);
  assert.deepEqual(tailwindConfigTarget.files(THEME).map(f => f.path),
    ['tailwind.config.js', 'tokens.css']);
  assert.deepEqual(injectTemplateTarget.files(THEME).map(f => f.path),
    ['hia-tokens.css', 'README.md']);
});

test('可复现性: 同一主题两次导出逐字节一致（deterministic output）', () => {
  for (const target of listExportTargets()) {
    const a = target.files(THEME);
    const b = target.files(THEME);
    assert.deepEqual(a, b, `${target.id} 两次导出应一致`);
    // 内容不含任何随机/时间痕迹（JSON 序列化即可比较）
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  }
});

test('WP theme.json: version 2 + 面板条目结构 + slug 合法唯一（schema-style assertions）', () => {
  const json = wpThemeJson();
  // 官方口径：顶层 version 字段（v2 兼容 WP 5.9+，6.6+ 自动迁移）
  assert.equal(json.version, 2);
  assert.ok(json.$schema.includes('schemas.wp.org'), '$schema 指向 WP 官方');
  const palette = json.settings.color.palette;
  // 结构断言：三字段齐备、类型正确
  for (const e of palette) {
    assert.equal(typeof e.name, 'string', 'name 字段');
    assert.equal(typeof e.slug, 'string', 'slug 字段');
    assert.equal(typeof e.color, 'string', 'color 字段');
    assert.match(e.slug, /^hia-[a-z0-9-]+$/, 'slug 限定 hia 前缀 + [a-z0-9-]');
  }
  // slug 全局唯一
  const slugs = palette.map(e => e.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slug 不得重复');
  // 主副色标准 10 档齐备
  for (const k of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']) {
    assert.ok(slugs.includes(`hia-primary-${k}`), `hia-primary-${k}`);
    assert.ok(slugs.includes(`hia-secondary-${k}`), `hia-secondary-${k}`);
  }
});

test('WP theme.json: 渐变预设字面量 + ADR-004 自定义档贯通（custom shades in palette & gradients）', () => {
  const json = wpThemeJson();
  const palette = json.settings.color.palette;
  // 渐变引用的 650 档进入面板（前缀隔离 slug）
  const custom = palette.find(e => e.slug === 'hia-primary-650');
  assert.ok(custom, '自定义档 hia-primary-650 应在面板中');
  assert.match(custom.color, /^#[0-9a-f]{6}$/i, '自定义档为合法 HEX');
  // 渐变条目：字面量 linear-gradient（WP 不解析 var()）
  const gradients = json.settings.color.gradients;
  assert.ok(gradients.length > 0, '默认渐变应有启用项');
  for (const g of gradients) {
    assert.equal(typeof g.gradient, 'string');
    assert.match(g.gradient, /^linear-gradient\(/, 'WP 渐变必须是字面量 CSS');
    assert.match(g.slug, /^hia-gradient-[a-z]+(-[a-z]+)*$/, '渐变 slug 全小写 kebab');
  }
  // 嵌入的 650 色值与面板一致（同源）
  const carousel = gradients.find(g => g.slug === 'hia-gradient-carousel');
  assert.ok(carousel, 'carousel 渐变存在');
  assert.ok(carousel.gradient.includes(custom.color), '渐变字面量应引用 650 档插值色');
});

test('WP theme.json: settings.custom 透传字体/间距令牌且键不含 --（typography/spacing passthrough）', () => {
  const json = wpThemeJson();
  const custom = json.settings.custom;
  assert.ok(custom.hia, 'custom.hia 子树存在');
  assert.equal(custom.hia.onPrimary, THEME.primary.on);
  assert.equal(custom.hia.font.body, "system-ui,'Segoe UI',sans-serif", '字体栈透传');
  assert.equal(custom.hia.fs.body, '16px', '字号基数 16px');
  assert.equal(custom.hia.space['0'], '8px', '间距 0 级 8px');
  // 官方约束：custom 键不得含 `--`（保留分隔符）
  const keys = [];
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      keys.push(prefix + k);
      if (v && typeof v === 'object') walk(v, prefix + k + '.');
    }
  };
  walk(custom, '');
  for (const k of keys) assert.ok(!k.includes('--'), `键 ${k} 不得含 --`);
});

test('WP style.css: 主题头含 Template 与 Text Domain + 变量注入（child theme header）', () => {
  const style = wordpressChildTarget.files(THEME).find(f => f.path === 'style.css').content;
  assert.match(style, /^\/\*\n/, 'WP 主题头必须位于文件起始注释块');
  assert.match(style, /Template: twentytwentyfour/, '默认父主题 TT4');
  assert.match(style, /Text Domain: hia-child-cobalt-demo/, 'Text Domain 用主题 slug');
  assert.match(style, /--hia-primary-500:/, '颜色变量注入');
  assert.match(style, /--hia-font-body:/, '字体变量注入');
  // 恶意主题名（含 */）不得破坏注释块：名称中的 */ 被中和为 *∕
  const evil = buildTheme({ name: '*/ evil', category: 'demo', primary: '#0047AB', secondary: '#00A8D3' });
  const evilStyle = wordpressChildTarget.files(evil).find(f => f.path === 'style.css').content;
  assert.ok(evilStyle.startsWith('/*\nTheme Name: *∕ evil — HIA Child\n'), '主题名中的 */ 应被中和');
});

test('Tailwind config: 可解析 + 全档色键 + 自定义档 + 字体族（parseable config）', () => {
  const config = tailwindConfig();
  const primary = config.theme.extend.colors.primary;
  const secondary = config.theme.extend.colors.secondary;
  assert.equal(primary.DEFAULT, '#0047AB', 'DEFAULT=基色');
  for (const k of ['50', '500', '900']) assert.ok(primary[k], `primary.${k}`);
  assert.ok(primary['650'], 'ADR-004 自定义档 650');
  assert.ok(secondary['500'], 'secondary.500');
  // 字体族透传（JSON 字符串字面量，含单引号栈应原样保留）
  assert.equal(config.theme.extend.fontFamily.body, "system-ui,'Segoe UI',sans-serif");
  assert.equal(config.theme.extend.fontFamily.heading, 'Georgia,serif');
});

test('tokens.css / hia-tokens.css: 颜色+字体+间距变量齐备（token css completeness）', () => {
  const twTokens = tailwindConfigTarget.files(THEME).find(f => f.path === 'tokens.css').content;
  const injectTokens = injectTemplateTarget.files(THEME).find(f => f.path === 'hia-tokens.css').content;
  for (const css of [twTokens, injectTokens]) {
    assert.match(css, /--hia-primary-500:/, '标准档颜色变量');
    assert.match(css, /--hia-primary-650:/, 'ADR-004 自定义档变量');
    assert.match(css, /--hia-gradient-carousel:\s*linear-gradient/, '渐变变量（export var 形态）');
    assert.match(css, /--hia-font-body:/, '字体变量');
    assert.match(css, /--hia-fs-body:\s*16px/, '字号变量');
    assert.match(css, /--hia-space-1:\s*16px/, '间距倍增序列');
  }
  // 注入模板 README 含三场景示例
  const readme = injectTemplateTarget.files(THEME).find(f => f.path === 'README.md').content;
  assert.match(readme, /Vue 3/, 'Vue 场景');
  assert.match(readme, /React/, 'React 场景');
  assert.match(readme, /纯 HTML/, '纯 HTML 场景');
});

test('archiveName: 主题 slug 化命名 + 中文回退 theme（deterministic archive names）', () => {
  assert.equal(wordpressChildTarget.archiveName(THEME), 'hia-wp-child-cobalt-demo.zip');
  assert.equal(tailwindConfigTarget.archiveName(THEME), 'hia-tailwind-cobalt-demo.zip');
  assert.equal(injectTemplateTarget.archiveName(THEME), 'hia-inject-cobalt-demo.zip');
  // 纯中文名 → slug 空 → 回退 theme
  const zh = buildTheme({ name: '钴蓝清透青', category: 'demo', primary: '#0047AB', secondary: '#00A8D3' });
  assert.equal(wordpressChildTarget.archiveName(zh), 'hia-wp-child-theme.zip');
});

test('禁用渐变不进入 WP 主题与 tokens.css（disabled gradients excluded）', () => {
  const theme = buildTheme({
    name: 'demo', category: 'demo', primary: '#0047AB', secondary: '#00A8D3',
    gradients: { ...GRADIENT_DEFAULTS, banner: { ...GRADIENT_DEFAULTS.banner, enabled: false } }
  });
  const json = wpThemeJson(theme);
  const gradSlugs = json.settings.color.gradients.map(g => g.slug);
  assert.ok(!gradSlugs.includes('hia-gradient-banner'), '禁用角色不生成预设');
  assert.ok(gradSlugs.includes('hia-gradient-carousel'), '启用角色保留');
});
