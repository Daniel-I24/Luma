const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_BYTES = 16;
const GROUPS = 8;

/** A byte of an address; a missing one reads as 0, which every check below treats as blocked. */
const byte = (bytes: readonly number[], i: number): number => bytes[i] ?? 0;

/** The four bytes of a dotted IPv4, or null. */
function v4Bytes(ip: string): number[] | null {
  const m = ip.match(IPV4);
  if (!m) return null;
  const bytes = m.slice(1).map(Number);
  return bytes.every((b) => b <= 255) ? bytes : null;
}

/** Private, loopback, link-local, metadata, CGNAT, benchmark, multicast and reserved IPv4 ranges. */
function blockedV4([a = 0, b = 0, c = 0]: readonly number[]): boolean {
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0 && c <= 2) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);
}

/**
 * The 16 bytes of an IPv6 address in any spelling: "::" shortening, a
 * dotted IPv4 tail ("::ffff:127.0.0.1"), brackets and a zone ("fe80::1%eth0").
 * Null when it is not one.
 */
function ipv6Bytes(text: string): number[] | null {
  const ip = text.replace(/^\[|\]$/g, '').replace(/%.*$/, '').toLowerCase();
  let groups = ip;
  const dotted = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const tail = v4Bytes(dotted[2] ?? '');
    if (!tail) return null;
    groups = `${dotted[1] ?? ''}${((byte(tail, 0) << 8) | byte(tail, 1)).toString(16)}:${((byte(tail, 2) << 8) | byte(tail, 3)).toString(16)}`;
  }
  const halves = groups.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = GROUPS - head.length - rest.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (!all.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.flatMap((g) => [parseInt(g, 16) >> 8, parseInt(g, 16) & 0xff]);
}

const zeros = (bytes: readonly number[], from: number, to: number): boolean => bytes.slice(from, to).every((b) => b === 0);

/** The IPv4 inside ::ffff:0:0/96, ::/96, 64:ff9b::/96 and 2002::/16 (6to4), or null. */
function embeddedV4(b: readonly number[]): number[] | null {
  if (zeros(b, 0, 10) && b[10] === 0xff && b[11] === 0xff) return b.slice(12);
  if (zeros(b, 0, 12)) return b.slice(12);
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && zeros(b, 4, 12)) return b.slice(12);
  if (b[0] === 0x20 && b[1] === 0x02) return b.slice(2, 6);
  return null;
}

/** Inside global unicast 2000::/3 but documentation (2001:db8::/32, 3fff::/20) or Teredo (2001::/32). */
function reservedGlobal(b: readonly number[]): boolean {
  const first32 = ((byte(b, 0) << 24) | (byte(b, 1) << 16) | (byte(b, 2) << 8) | byte(b, 3)) >>> 0;
  return first32 === 0x20010db8 || first32 === 0x20010000 || (byte(b, 0) === 0x3f && (byte(b, 1) & 0xf0) === 0xf0);
}

/**
 * True when no request may go to this address. IPv4: the private and
 * reserved ranges (metadata 169.254.169.254 included). IPv6: parsed to its
 * 16 bytes; anything outside global unicast 2000::/3 is refused, and the
 * IPv4 list applies to every embedded IPv4 (mapped, compatible, NAT64, 6to4).
 * Anything that does not parse is refused.
 */
export function isBlockedAddress(ip: string): boolean {
  const v4 = v4Bytes(ip);
  if (v4) return blockedV4(v4);
  if (IPV4.test(ip)) return true;
  const bytes = ipv6Bytes(ip);
  if (!bytes || bytes.length !== IPV6_BYTES) return true;
  const inner = embeddedV4(bytes);
  if (inner && blockedV4(inner)) return true;
  return (byte(bytes, 0) & 0xe0) !== 0x20 || reservedGlobal(bytes);
}

/** True for a dotted IPv4 literal (never a host to fetch by name). */
export function isIpv4Literal(host: string): boolean {
  return IPV4.test(host);
}
