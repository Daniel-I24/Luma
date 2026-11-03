/** Constant-time comparisons of secrets and signatures. */
export class SecureCompare {
  /** Same length and same bytes, without an early exit on the first difference. */
  public static equal(given: string, expected: string): boolean {
    const a = new TextEncoder().encode(given);
    const b = new TextEncoder().encode(expected);
    let diff = a.length ^ b.length;
    for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
    return diff === 0;
  }

  /** Hex digests compared case-insensitively (Wompi sends upper-case checksums). */
  public static equalHex(given: string, expected: string): boolean {
    return SecureCompare.equal(given.toLowerCase(), expected.toLowerCase());
  }
}

/** Lower-case hex SHA-256 of a UTF-8 string. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
