/**
 * @lang zh-CN TDOT 模板语言单测（`W-tb-P32` / ADR-011）：覆盖七类能力、五个错误码、
 *   三个上限、`@build.*` 注入与方案 B 版本路由。
 * @lang en TDOT template-language tests (`W-tb-P32` / ADR-011): the seven capabilities, five error codes,
 *   three caps, `@build.*` injection and option-B version routing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateTdot, lexTdot, parseTdot, shouldEvaluateTdot, isUnsupportedTdotVersion, tdotData,
  TDOT_SPEC_VERSION, TDOT_MAX_EXPR_DEPTH, TDOT_MAX_NODES
} from '../dist/index.js';

/** @lang zh-CN 求值包装：断言成功并返回输出。 @lang en Eval wrapper: asserts success and returns output. */
function out(src, data = {}, build) {
  const r = evaluateTdot(src, data, build);
  assert.equal(r.ok, true, r.ok ? '' : `${r.error.code} @${r.error.pos}: ${r.error.message}`);
  return r.output;
}
/** @lang zh-CN 求值包装：断言失败并返回错误。 @lang en Eval wrapper: asserts failure and returns the error. */
function err(src, data = {}) {
  const r = evaluateTdot(src, data);
  assert.equal(r.ok, false, 'expected a failure');
  return r.error;
}

// ===== 1. 文本与变量插值 =====
test('纯文本原样输出', () => {
  assert.equal(out('Hello world'), 'Hello world');
  assert.equal(out(''), '');
});

test('变量插值（含嵌套路径）', () => {
  assert.equal(out('Hi {{ name }}', { name: 'Ada' }), 'Hi Ada');
  assert.equal(out('{{ project.name }}', { project: { name: 'HIA' } }), 'HIA');
});

test('插值输出类型：数字/布尔/null', () => {
  assert.equal(out('{{ n }}', { n: 42 }), '42');
  assert.equal(out('{{ b }}', { b: true }), 'true');
  assert.equal(out('{{ z }}', { z: null }), '');
});

test('未定义变量 → 空串 + 警告（不报错）', () => {
  const r = evaluateTdot('a{{ missing }}b', {});
  assert.equal(r.ok, true);
  assert.equal(r.output, 'ab');
  assert.ok(r.warnings.some(w => w.code === 'W_TDOT_UNDEFINED'));
});

// ===== 2. 条件 =====
test('if / else 分支', () => {
  const src = '{{#if flag}}yes{{else}}no{{/if}}';
  assert.equal(out(src, { flag: true }), 'yes');
  assert.equal(out(src, { flag: false }), 'no');
});

test('if 无 else 时假值渲染空', () => {
  assert.equal(out('{{#if flag}}X{{/if}}', { flag: false }), '');
});

test('真值规则：空串/0/空数组为假', () => {
  assert.equal(out('{{#if v}}T{{else}}F{{/if}}', { v: '' }), 'F');
  assert.equal(out('{{#if v}}T{{else}}F{{/if}}', { v: 0 }), 'F');
  assert.equal(out('{{#if v}}T{{else}}F{{/if}}', { v: [] }), 'F');
  assert.equal(out('{{#if v}}T{{else}}F{{/if}}', { v: [1] }), 'T');
});

// ===== 3. 遍历 =====
test('each 遍历数组，this 与 @index 可用', () => {
  assert.equal(out('{{#each items}}{{ @index }}:{{ this }};{{/each}}', { items: ['a', 'b'] }), '0:a;1:b;');
});

test('each 源为空数组 → 渲染空', () => {
  assert.equal(out('{{#each items}}x{{/each}}', { items: [] }), '');
});

test('each 源未定义 → 空 + 警告', () => {
  const r = evaluateTdot('{{#each items}}x{{/each}}', {});
  assert.equal(r.ok, true);
  assert.equal(r.output, '');
  assert.ok(r.warnings.some(w => w.code === 'W_TDOT_UNDEFINED'));
});

test('each 源非数组 → E_TDOT_TYPE', () => {
  assert.equal(err('{{#each items}}x{{/each}}', { items: 'nope' }).code, 'E_TDOT_TYPE');
});

test('嵌套 each 与外层 After 恢复', () => {
  const src = '{{#each rows}}{{#each this}}{{ this }}{{/each}}|{{/each}}';
  assert.equal(out(src, { rows: [['a', 'b'], ['c']] }), 'ab|c|');
});

// ===== 4. 比较 =====
test('比较运算六种', () => {
  assert.equal(out('{{#if a == b}}Y{{else}}N{{/if}}', { a: 1, b: 1 }), 'Y');
  assert.equal(out('{{#if a != b}}Y{{else}}N{{/if}}', { a: 1, b: 2 }), 'Y');
  assert.equal(out('{{#if a > b}}Y{{else}}N{{/if}}', { a: 2, b: 1 }), 'Y');
  assert.equal(out('{{#if a < b}}Y{{else}}N{{/if}}', { a: 1, b: 2 }), 'Y');
  assert.equal(out('{{#if a >= b}}Y{{else}}N{{/if}}', { a: 2, b: 2 }), 'Y');
  assert.equal(out('{{#if a <= b}}Y{{else}}N{{/if}}', { a: 2, b: 2 }), 'Y');
});

test('字符串比较', () => {
  assert.equal(out('{{#if a == "x"}}Y{{else}}N{{/if}}', { a: 'x' }), 'Y');
  assert.equal(out('{{#if a > "a"}}Y{{else}}N{{/if}}', { a: 'b' }), 'Y');
});

test('混类型大小比较 → E_TDOT_TYPE', () => {
  assert.equal(err('{{#if a > b}}Y{{/if}}', { a: 'x', b: 1 }).code, 'E_TDOT_TYPE');
});

test('跨类型相等不报错（恒 false）', () => {
  assert.equal(out('{{#if a == b}}Y{{else}}N{{/if}}', { a: '1', b: 1 }), 'N');
});

// ===== 5. 算术（仅 + 与 -）=====
test('加法：数字相加 / 字符串拼接', () => {
  assert.equal(out('{{ a + b }}', { a: 1, b: 2 }), '3');
  assert.equal(out('{{ a + b }}', { a: 'x', b: 'y' }), 'xy');
});

test('减法：仅数字', () => {
  assert.equal(out('{{ a - b }}', { a: 5, b: 2 }), '3');
  assert.equal(err('{{ a - b }}', { a: 'x', b: 1 }).code, 'E_TDOT_TYPE');
});

test('混合类型加法 → E_TDOT_TYPE', () => {
  assert.equal(err('{{ a + b }}', { a: 1, b: 'x' }).code, 'E_TDOT_TYPE');
});

test('加减优先级高于比较', () => {
  // a + 1 > b 应解析为 (a + 1) > b
  assert.equal(out('{{#if a + 1 > b}}Y{{else}}N{{/if}}', { a: 2, b: 2 }), 'Y');
});

test('乘除取模不支持（语法错误）', () => {
  // ADR-011 §1：`*` `/` `%` 不在词汇表，词法层直接拒绝。
  const r = evaluateTdot('{{ a * b }}', { a: 2, b: 3 });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'E_TDOT_SYNTAX');
});

// ===== 6. 否定 =====
test('一元否定', () => {
  assert.equal(out('{{#if !a}}Y{{else}}N{{/if}}', { a: false }), 'Y');
  assert.equal(out('{{#if !a}}Y{{else}}N{{/if}}', { a: true }), 'N');
});

// ===== 7. @build 占位符（ADR-011 §4.1）=====
test('@build.* 注入后可用', () => {
  const build = { year: '2026', date: '2026-11-13', timestamp: 1763000000, random: 0.5 };
  assert.equal(out('{{ @build.year }}', {}, build), '2026');
  assert.equal(out('{{ @build.date }}', {}, build), '2026-11-13');
  assert.equal(out('{{ @build.timestamp }}', {}, build), '1763000000');
  assert.equal(out('{{ @build.random }}', {}, build), '0.5');
});

test('@build.* 未注入 → 空串 + 警告', () => {
  const r = evaluateTdot('x{{ @build.date }}y', {});
  assert.equal(r.ok, true);
  assert.equal(r.output, 'xy');
  assert.ok(r.warnings.some(w => w.code === 'W_TDOT_UNDEFINED'));
});

test('求值器不引入不确定性：同输入同输出', () => {
  const build = { random: 0.42, timestamp: 1 };
  const a = out('{{ @build.random }}-{{ @build.timestamp }}', {}, build);
  const b = out('{{ @build.random }}-{{ @build.timestamp }}', {}, build);
  assert.equal(a, b);
});

// ===== 8. 错误码 =====
test('E_TDOT_SYNTAX：未闭合标签', () => {
  assert.equal(err('{{ name').code, 'E_TDOT_SYNTAX');
});

test('E_TDOT_SYNTAX：块未闭合', () => {
  assert.equal(err('{{#if a}}x').code, 'E_TDOT_SYNTAX');
});

test('E_TDOT_SYNTAX：块闭合不匹配', () => {
  assert.equal(err('{{#if a}}x{{/each}}', { a: 1 }).code, 'E_TDOT_SYNTAX');
});

test('E_TDOT_SYNTAX：each 内 else 不支持', () => {
  assert.equal(err('{{#each a}}x{{else}}y{{/each}}', { a: [1] }).code, 'E_TDOT_SYNTAX');
});

test('E_TDOT_SYNTAX：函数调用形式被拒', () => {
  // ADR-011 §4.1：禁止 now()/random() 之类函数调用，占位符是唯一入口。
  const r = evaluateTdot('{{ now() }}', {});
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'E_TDOT_SYNTAX');
});

// ===== 9. 上限 =====
test('E_TDOT_LIMIT：表达式嵌套超限', () => {
  // 用连续一元否定构造深嵌套（每层计一次深度）。
  const deep = '{{' + '!'.repeat(TDOT_MAX_EXPR_DEPTH + 3) + 'a}}';
  const r = evaluateTdot(deep, { a: true });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'E_TDOT_LIMIT');
});

test('E_TDOT_LIMIT：节点数超限', () => {
  const many = '{{#if a}}' + 'x'.repeat(1) + '{{/if}}';
  const src = Array.from({ length: TDOT_MAX_NODES + 10 }, () => many).join('');
  const r = evaluateTdot(src, { a: true });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'E_TDOT_LIMIT');
});

// ===== 10. 方案 B 版本路由（ADR-011 §5）=====
test('shouldEvaluateTdot：仅 specVersion === tdot-0.1 才求值', () => {
  assert.equal(shouldEvaluateTdot({ specVersion: TDOT_SPEC_VERSION }), true);
  assert.equal(shouldEvaluateTdot({ specVersion: 'tdot-0.9' }), false);
  assert.equal(shouldEvaluateTdot({ specVersion: 'tdon-0.2' }), false);
  assert.equal(shouldEvaluateTdot({}), false);
  assert.equal(shouldEvaluateTdot(null), false);
});

test('isUnsupportedTdotVersion：tdot-* 但版本不符才算不支持', () => {
  assert.equal(isUnsupportedTdotVersion({ specVersion: 'tdot-0.9' }), true);
  assert.equal(isUnsupportedTdotVersion({ specVersion: TDOT_SPEC_VERSION }), false);
  assert.equal(isUnsupportedTdotVersion({ specVersion: 'tdon-0.2' }), false);
  assert.equal(isUnsupportedTdotVersion({}), false);
});

test('tdotData：非对象 data 归一为空对象', () => {
  assert.deepEqual(tdotData({ data: { a: 1 } }), { a: 1 });
  assert.deepEqual(tdotData({ data: [1, 2] }), {});
  assert.deepEqual(tdotData({ data: 'x' }), {});
  assert.deepEqual(tdotData({}), {});
});

// ===== 11. 词法与解析的独立可用性 =====
test('lexTdot 可独立使用（token 序列）', () => {
  const r = lexTdot('a{{ b }}c');
  assert.equal(r.ok, true);
  assert.deepEqual(r.tokens.map(t => t.type), ['text', 'open', 'ident', 'close', 'text', 'eof']);
});

test('parseTdot 可独立使用（AST）', () => {
  const lex = lexTdot('{{#if x}}A{{else}}B{{/if}}');
  assert.equal(lex.ok, true);
  const p = parseTdot('', lex.tokens);
  assert.equal(p.ok, true);
  assert.equal(p.nodes[0].kind, 'if');
});
