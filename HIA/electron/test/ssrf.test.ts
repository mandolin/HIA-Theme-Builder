/**
 * @lang zh-CN Electron SSRF 校验单测：覆盖私网/回环/元数据/协议/端口拦截与合法地址放行。
 * @lang en Electron SSRF guard tests: private/loopback/metadata/scheme/port blocks and legit pass.
 */

import { describe, it, expect } from 'vitest';
import { guardUrl, isPrivateIp, resolveHostSafe, guardUrlDeep } from '../src/ssrf.js';

describe('electron/ssrf guardUrl', () => {
  it('放行合法公开 https 地址', () => {
    const r = guardUrl('https://example.com/theme');
    expect(r.ok).toBe(true);
  });

  it('拦截回环 localhost', () => {
    expect(guardUrl('http://localhost:8080').ok).toBe(false);
  });

  it('拦截回环 IP', () => {
    expect(guardUrl('http://127.0.0.1/').ok).toBe(false);
  });

  it('拦截 RFC1918 私网', () => {
    expect(guardUrl('http://192.168.1.10/').ok).toBe(false);
    expect(guardUrl('http://10.0.0.5/').ok).toBe(false);
    expect(guardUrl('http://172.16.5.5/').ok).toBe(false);
  });

  it('拦截云元数据地址', () => {
    expect(guardUrl('http://169.254.169.254/latest/').ok).toBe(false);
  });

  it('拦截非 http/https 协议', () => {
    expect(guardUrl('file:///etc/passwd').ok).toBe(false);
    expect(guardUrl('ftp://example.com').ok).toBe(false);
  });

  it('拦截非常规端口', () => {
    expect(guardUrl('http://example.com:22/').ok).toBe(false);
    expect(guardUrl('https://example.com:8443/').ok).toBe(true);
  });

  it('非法 URL 被拒', () => {
    expect(guardUrl('not-a-url').ok).toBe(false);
  });
});

describe('electron/ssrf isPrivateIp', () => {
  it('识别私网 IPv4 与保留段', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('172.16.5.5')).toBe(true);
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('100.64.0.1')).toBe(true);
  });

  it('放行公网 IPv4', () => {
    expect(isPrivateIp('93.184.216.34')).toBe(false); // <lang zh-CN>example.com 历史 IP</lang>
  });

  it('识别私网/保留 IPv6', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fd00::1')).toBe(true);
    expect(isPrivateIp('::')).toBe(true);
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:169.254.169.254')).toBe(true);
  });

  it('放行公网 IPv6', () => {
    expect(isPrivateIp('2606:2800:220:1:248:1893:25c8:1946')).toBe(false); // <lang zh-CN>example.com AAAA</lang>
  });
});

describe('electron/ssrf resolveHostSafe (DNS rebinding 二次校验)', () => {
  it('解析失败 fail-closed 阻断（不可解析域名）', async () => {
    const r = await resolveHostSafe('nonexistent.invalid');
    expect(r.blocked).toBe(true);
  });

  it('解析到回环/私网被阻断', async () => {
    // <lang zh-CN>localhost 默认解析到回环；非测试态应被阻断。</lang>
    const r = await resolveHostSafe('localhost');
    expect(r.blocked).toBe(true);
  });

  it('guardUrlDeep 在解析阻断时返回 SSRF 原因', async () => {
    const r = await guardUrlDeep('http://localhost:8080/x');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason.startsWith('SSRF:')).toBe(true);
  });
});
