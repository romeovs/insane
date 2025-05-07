import * as int64 from "~/lib/int64"

/**
 * Encode an arbitrary-size bigint into a Uint8Array.
 *
 * Uses the faster int64.encode when possible.
 *
 * @param number
 *	 The number to encode. Must be a positive integer.
 * @returns
 *   A Uint8Array representing the number.
 */
export function encode(number: number | bigint): Uint8Array {
	let num = BigInt(number)

	if (num === 0n) {
		return new Uint8Array([0])
	}

	if (num < 0n) {
		throw new Error("int.encode only supports positive integers")
	}

	// special case is faster
	if (num <= int64.MAX_SAFE_BIGINT64) {
		return int64.encode(num)
	}

	const decoded: number[] = []

	while (num) {
		decoded.push(Number(num & 0xffn))
		num >>= 8n
	}

	return new Uint8Array(decoded)
}

/**
 * Decode a Uint8Array of arbitrary size into a bigint.
 *
 * Uses the faster int64.decode when possible.
 *
 * @param buf
 *   A Uint8Array of arbitrary length.
 * @returns
 *   A bigint representing the same number.
 */
export function decode(buf: Uint8Array | number[]): bigint {
	if (buf.length === 8) {
		return int64.decode(buf)
	}

	let encoded = 0n

	for (let i = 0; i < buf.length; i++) {
		encoded |= BigInt(buf[i]!) << BigInt(i * 8)
	}

	return encoded
}
