/**
 * @lang zh-CN 网址取色的 SSRF 安全校验：禁止私网/回环/链路本地/云元数据地址，并限制协议与端口。
 * 取色前的强制关卡；错误携带原因供 UI 提示。
 * @lang en SSRF safety guard for URL color extraction: block private/loopback/link-local/cloud-metadata, restrict scheme and ports. Mandatory gate before fetching; error carries reason for UI.
 */

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
  // <lang zh-CN>localhost 及回环域名（测试态放行）。</lang>
  // <lang en>localhost and loopback names (allowed in test mode).</lang>
  if (!testLocal && (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '[::1]')) {
    return { ok: false, reason: '本地回环地址禁止 / loopback blocked' };
  }
  return { ok: true, host, port };
}
