/**
 * @lang zh-CN Tauri SSRF 校验单测（与 electron 语义一致）：覆盖私网/回环/元数据/协议/端口拦截与合法放行。
 * @lang en Tauri SSRF guard tests (same semantics as electron): private/loopback/metadata/scheme/port blocks and legit pass.
 */

import { describe, it, expect } from 'vitest';
import { guardUrl } from '../src/ssrf.js';

describe('tauri/ssrf guardUrl', () => {
  it('放行合法公开 https 地址', () => {
    expect(guardUrl('https://example.com/theme').ok).toBe(true);
  });
  it('拦截回环 localhost 与 127.0.0.1', () => {
    expect(guardUrl('http://localhost:8080').ok).toBe(false);
    expect(guardUrl('http://127.0.0.1/').ok).toBe(false);
  });
  it('拦截 RFC1918 私网', () => {
    expect(guardUrl('http://192.168.1.10/').ok).toBe(false);
    expect(guardUrl('http://10.0.0.5/').ok).toBe(false);
  });
  it('拦截云元数据地址', () => {
    expect(guardUrl('http://169.254.169.254/latest/').ok).toBe(false);
  });
  it('拦截非 http/https 协议', () => {
    expect(guardUrl('file:///etc/passwd').ok).toBe(false);
  });
  it('拦截非常规端口、放行 8443', () => {
    expect(guardUrl('http://example.com:22/').ok).toBe(false);
    expect(guardUrl('https://example.com:8443/').ok).toBe(true);
  });
});
