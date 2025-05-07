export const MAX_SAFE_BIGINT64 = (1n << 64n) - 1n

/**
 * Encode a 64-bit integer as a Uint8Array of length 8.
 *
 * @param number
 *	 The number to encode. Must be a positive integer
 *	 smaller than MAX_SAFE_BIGINT64.
 * @returns
 *   A Uint8Array of length 8.
 */
export function encode(number: number | bigint): Uint8Array {
	const num = BigInt(number)

	if (num < 0n) {
		throw new Error("int64.encode only supports positive integers")
	}

	if (num > MAX_SAFE_BIGINT64) {
		throw new Error("int64.encode only supports 64-bit integers")
	}

	const result = new Uint8Array(8)

	result[0] = Number(num & 0xffn)
	result[1] = Number((num >> 8n) & 0xffn)
	result[2] = Number((num >> 16n) & 0xffn)
	result[3] = Number((num >> 24n) & 0xffn)

	result[4] = Number((num >> 32n) & 0xffn)
	result[5] = Number((num >> 40n) & 0xffn)
	result[6] = Number((num >> 48n) & 0xffn)
	result[7] = Number((num >> 56n) & 0xffn)

	return result
}

/**
 * Decode a Uint8Array of length 8 into a 64-bit bigint.
 *
 * @param buf
 *   A Uint8Array of length 8.
 * @returns
 *   A bigint representing the same number.
 */
export function decode(buf: Uint8Array | number[]): bigint {
	if (buf.length > 8) {
		throw new Error("int64.decode only supports 64-bit integers")
	}

	return (
		(BigInt(buf[0] ?? 0) << 0n) |
		(BigInt(buf[1] ?? 0) << 8n) |
		(BigInt(buf[2] ?? 0) << 16n) |
		(BigInt(buf[3] ?? 0) << 24n) |
		(BigInt(buf[4] ?? 0) << 32n) |
		(BigInt(buf[5] ?? 0) << 40n) |
		(BigInt(buf[6] ?? 0) << 48n) |
		(BigInt(buf[7] ?? 0) << 56n)
	)
}
