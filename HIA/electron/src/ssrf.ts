/**
 * @lang zh-CN 网址取色的 SSRF 安全校验：禁止私网/回环/链路本地/云元数据地址，并限制协议与端口。
 * 取色前的强制关卡；错误携带原因供 UI 提示。
 * @lang en SSRF safety guard for URL color extraction: block private/loopback/link-local/cloud-metadata, restrict scheme and ports. Mandatory gate before fetching; error carries reason for UI.
 */

import dns from 'node:dns';

/** @lang zh-CN 校验失败原因。 @lang en Validation failure reason. */
export interface SsrfReject {
  ok: false;
  reason: string;
}

/** @lang zh-CN 校验通过结果。 @lang en Validation pass result. */
export interface SsrfAccept {
  ok: true;
  host: string;
  port: number;
}

/** @lang zh-CN 云元数据地址（AWS/GCP/Azure/阿里云等），必须拦截。 @lang en Cloud metadata addresses (AWS/GCP/Azure/Aliyun etc.), must be blocked. */
const METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.google.internal.',
  'fd00:ec2::254'
]);

/**
 * @lang zh-CN 判断一个 IPv4 地址是否属于私网/保留段（RFC 1918、CGNAT、回环、链路本地、广播等）。
 * @lang en Decide if an IPv4 is private/reserved (RFC 1918, CGNAT, loopback, link-local, broadcast, etc.).
 */
function isPrivateIpv4(ip: string): boolean {
  // <lang zh-CN>逐段解析，非标准点分十进制直接拒绝。</lang>
  // <lang en>Parse octets; reject non-standard dotted-decimal outright.</lang>
  const parts = ip.split('.');
  if (parts.length !== 4) return true;
  const o = parts.map((p) => Number(p));
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  if (a === 10) return true; // <lang zh-CN>10.0.0.0/8</lang> // <lang en>10.0.0.0/8</lang>
  if (a === 127) return true; // <lang zh-CN>回环 127.0.0.0/8</lang> // <lang en>loopback 127.0.0.0/8</lang>
  if (a === 0) return true; // <lang zh-CN>本网络</lang> // <lang en>this network</lang>
  if (a === 169 && b === 254) return true; // <lang zh-CN>链路本地 + 元数据</lang> // <lang en>link-local + metadata</lang>
  if (a === 172 && b >= 16 && b <= 31) return true; // <lang zh-CN>172.16.0.0/12</lang> // <lang en>172.16.0.0/12</lang>
  if (a === 192 && b === 168) return true; // <lang zh-CN>192.168.0.0/16</lang> // <lang en>192.168.0.0/16</lang>
  if (a === 100 && b >= 64 && b <= 127) return true; // <lang zh-CN>CGNAT 100.64.0.0/10</lang> // <lang en>CGNAT 100.64.0.0/10</lang>
  if (a >= 224) return true; // <lang zh-CN>组播/保留</lang> // <lang en>multicast/reserved</lang>
  return false;
}

/**
 * @lang zh-CN 校验待抓取的 URL：协议限 http/https，端口限 80/443/8080/8443，主机解析后不得为私网/元数据。
 * 同步完成字符串与已知字面量检查；DNS 解析检查由调用方在异步层补充（此处仅做字面量 IP 拦截）。
 * @lang en Validate a URL to fetch: scheme http/https, ports 80/443/8080/8443, host must not be private/metadata after resolution. Synchronous literal checks here; DNS resolution check by async caller.
 */
export function guardUrl(raw: string): SsrfReject | SsrfAccept {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL 格式非法 / invalid URL' };
  }
  // <lang zh-CN>测试逃生舱：仅当显式设置 HIA_TEST_LOCAL=1 时允许 file: 与回环地址，
  //   用于本地 fixture 冒烟；生产默认关闭，不影响 SSRF 防护。</lang>
  // <lang en>Test escape hatch: only when HIA_TEST_LOCAL=1, allow file: and loopback for local fixture smoke;
  //   off by default in production, SSRF guard unchanged.</lang>
  const testLocal = process.env.HIA_TEST_LOCAL === '1';
  // <lang zh-CN>协议限制（测试态额外允许 file:）。</lang>
  // <lang en>Scheme restriction (test mode additionally allows file:).</lang>
  if (url.protocol !== 'http:' && url.protocol !== 'https:' && !(testLocal && url.protocol === 'file:')) {
    return { ok: false, reason: `不允许的协议 ${url.protocol} / disallowed scheme` };
  }
  // <lang zh-CN>端口限制（缺省按协议）。</lang>
  // <lang en>Port restriction (default by scheme).</lang>
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (![80, 443, 8080, 8443].includes(port)) {
    return { ok: false, reason: `不允许的端口 ${port} / disallowed port` };
  }
  const host = url.hostname.toLowerCase();
  // <lang zh-CN>元数据主机直拒。</lang>
  // <lang en>Metadata hosts rejected directly.</lang>
  if (METADATA_HOSTS.has(host)) {
    return { ok: false, reason: '云元数据地址禁止访问 / cloud metadata blocked' };
  }
  // <lang zh-CN>字面量 IPv4 私网检查。</lang>
  // <lang en>Literal IPv4 private check.</lang>
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIpv4(host)) {
    return { ok: false, reason: '私网/保留地址禁止 / private address blocked' };
  }
  // <lang zh-CN>字面量 IPv6 私网检查（ULA/回环/链路本地/未指定/映射私网）。</lang>
  // <lang en>Literal IPv6 private check (ULA/loopback/link-local/unspecified/mapped-private).</lang>
  if (host.startsWith('[') && host.endsWith(']')) {
    const v6 = host.slice(1, -1);
    if (isPrivateIpv6(v6)) {
      return { ok: false, reason: '私网/保留 IPv6 禁止 / private IPv6 blocked' };
    }
  }
  // <lang zh-CN>localhost 及回环域名（测试态放行）。</lang>
  // <lang en>localhost and loopback names (allowed in test mode).</lang>
  if (!testLocal && (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '[::1]')) {
    return { ok: false, reason: '本地回环地址禁止 / loopback blocked' };
  }
  return { ok: true, host, port };
}

/**
 * @lang zh-CN 判断 IPv6 是否为私网/保留段：ULA(fd00::/8)、回环(::1)、链路本地(fe80::/10)、
 *   未指定(::)、IPv4 映射地址(::ffff:a.b.c.d 且内嵌 IPv4 私网)、以及文档点名的 IPv4 映射元数据。
 * @lang en Decide if IPv6 is private/reserved: ULA(fd00::/8), loopback(::1), link-local(fe80::/10),
 *   unspecified(::), IPv4-mapped (::ffff:a.b.c.d with embedded private IPv4), and mapped metadata.
 */
function isPrivateIpv6(ip: string): boolean {
  const v = ip.toLowerCase().trim();
  if (v === '::1' || v === '::' || v === 'fe80::' || v.startsWith('fe80:')) return true; // <lang zh-CN>回环/未指定/链路本地</lang> // <lang en>loopback/unspecified/link-local</lang>
  if (v.startsWith('fd') || v.startsWith('fc')) return true; // <lang zh-CN>ULA fd00::/8 / fc00::/8</lang> // <lang en>ULA fd00::/8 / fc00::/8</lang>
  // <lang zh-CN>IPv4 映射地址（::ffff:a.b.c.d）抽取内嵌 IPv4 复用私网判断。</lang>
  // <lang en>IPv4-mapped (::ffff:a.b.c.d) extract embedded IPv4 and reuse private check.</lang>
  const mapped = v.startsWith('::ffff:') ? v.slice(7) : (v.startsWith('::') && /^\d{1,3}(\.\d{1,3}){3}$/.test(v.slice(2)) ? v.slice(2) : '');
  if (mapped && /^\d{1,3}(\.\d{1,3}){3}$/.test(mapped) && isPrivateIpv4(mapped)) return true;
  // <lang zh-CN>IPv4 映射元数据（::ffff:169.254.169.254）。</lang>
  // <lang en>IPv4-mapped metadata (::ffff:169.254.169.254).</lang>
  if (mapped === '169.254.169.254') return true;
  return false;
}

/**
 * @lang zh-CN 统一私网判定入口：IPv4 走 isPrivateIpv4，IPv6 走 isPrivateIpv6，兼容方括号/裸地址。
 * @lang en Unified private check: IPv4→isPrivateIpv4, IPv6→isPrivateIpv6, tolerant of brackets/bare.
 */
export function isPrivateIp(ip: string): boolean {
  const v = ip.trim();
  const bare = v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1) : v;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return isPrivateIpv4(bare);
  return isPrivateIpv6(bare);
}

/**
 * @lang zh-CN 运行时 DNS 解析二次校验：解析 host 的全部 A/AAAA，逐个检查是否为私网/保留/元数据。
 *   解析失败按 fail-closed 处理（阻断），防止 DNS rebinding 把公开域名在连接时跳到私网。
 * @lang en Runtime DNS resolution 2nd-check: resolve all A/AAAA of host, check each for private/reserved/metadata.
 *   Resolution failure is fail-closed (blocked) to prevent DNS rebinding jumping a public name to a private IP at connect time.
 */
export async function resolveHostSafe(host: string): Promise<{ blocked: boolean; reason?: string }> {
  const testLocal = process.env.HIA_TEST_LOCAL === '1';
  if (testLocal && (host === 'localhost' || host.endsWith('.localhost'))) return { blocked: false };
  let addrs: { address: string; family: number }[];
  try {
    addrs = await dns.promises.lookup(host, { all: true });
  } catch {
    // <lang zh-CN>解析失败（NXDOMAIN/超时等）一律阻断，避免绕过。</lang>
    // <lang en>Resolution failure (NXDOMAIN/timeout) is blocked unconditionally.</lang>
    return { blocked: true, reason: 'DNS 解析失败 / DNS resolution failed' };
  }
  if (addrs.length === 0) return { blocked: true, reason: 'DNS 无解析结果 / no DNS records' };
  for (const a of addrs) {
    // <lang zh-CN>family 6 为 IPv6 地址字符串，family 4 为 IPv4 字符串；均经统一私网判定。</lang>
    // <lang en>family 6 = IPv6 string, family 4 = IPv4 string; both via unified private check.</lang>
    if (isPrivateIp(a.address)) {
      return { blocked: true, reason: `DNS 解析到私网/保留地址 ${a.address} / resolved to private ${a.address}` };
    }
  }
  return { blocked: false };
}

/**
 * @lang zh-CN 深度校验（导航前调用）：先同步字面量关卡 guardUrl，再异步 DNS 解析二次校验。
 *   二者皆过才放行，返回 { ok:true, host, port }，否则携带 SSRF 原因。
 * @lang en Deep check (before navigation): synchronous literal guardUrl then async DNS 2nd-check. Passes only if both clear.
 */
export async function guardUrlDeep(raw: string): Promise<SsrfReject | SsrfAccept> {
  const first = guardUrl(raw);
  if (!first.ok) return { ok: false, reason: 'SSRF:' + first.reason };
  const res = await resolveHostSafe(first.host);
  if (res.blocked) return { ok: false, reason: 'SSRF:' + (res.reason ?? 'DNS rebinding/私网') };
  return first;
}

/**
 * @lang zh-CN 请求级关卡（webRequest 拦截器用）：对每个请求/重定向 URL 做同步字面量校验。
 *   域名型 host 的 DNS rebinding 由导航前 resolveHostSafe 兜底；此处拦截字面量私网/IP 变体与非常规协议。
 * @lang en Per-request gate (for webRequest interceptors): synchronous literal check on every request/redirect URL.
 *   DNS-rebinding for domain hosts is covered by pre-navigation resolveHostSafe; here we block literal private/IP variants and odd schemes.
 */
export function guardRequestUrl(urlStr: string): { ok: boolean; reason?: string } {
  const r = guardUrl(urlStr);
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
}
