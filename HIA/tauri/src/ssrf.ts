/**
 * @lang zh-CN 网址取色的 SSRF 安全校验（Tauri 前端侧等价实现）：禁止私网/回环/链路本地/云元数据，限协议与端口。
 * 与 HIA/electron 的同名模块语义一致，作为 WebView 内取色前的强制关卡；Rust 后端再做一层校验。
 * @lang en SSRF safety guard for URL extraction (Tauri front-end equivalent): block private/loopback/link-local/cloud-metadata, restrict scheme/ports. Same semantics as HIA/electron; mandatory gate before fetch in WebView; Rust backend re-checks.
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

/** @lang zh-CN 云元数据地址，必须拦截。 @lang en Cloud metadata addresses, must block. */
const METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'fd00:ec2::254'
]);

/**
 * @lang zh-CN 判断 IPv4 是否私网/保留段（RFC 1918、CGNAT、回环、链路本地、组播等）。
 * @lang en Decide if IPv4 is private/reserved (RFC 1918, CGNAT, loopback, link-local, multicast, etc.).
 */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return true;
  const o = parts.map((p) => Number(p));
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

/**
 * @lang zh-CN 校验待抓取 URL 的协议/端口/主机。字面量 IP 私网检查在此完成；域名 DNS 解析由 Rust 后端补充。
 * @lang en Validate scheme/port/host of a URL to fetch. Literal-IP private check here; DNS resolution by Rust backend.
 */
export function guardUrl(raw: string): SsrfReject | SsrfAccept {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'URL 格式非法 / invalid URL' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: `不允许的协议 ${url.protocol} / disallowed scheme` };
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (![80, 443, 8080, 8443].includes(port)) {
    return { ok: false, reason: `不允许的端口 ${port} / disallowed port` };
  }
  const host = url.hostname.toLowerCase();
  if (METADATA_HOSTS.has(host)) return { ok: false, reason: '云元数据地址禁止访问 / cloud metadata blocked' };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIpv4(host)) {
    return { ok: false, reason: '私网/保留地址禁止 / private address blocked' };
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host === '0.0.0.0' || host === '[::1]') {
    return { ok: false, reason: '本地回环地址禁止 / loopback blocked' };
  }
  return { ok: true, host, port };
}
