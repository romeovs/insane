import { expect, test } from "vitest"
import { MAX_SAFE_BIGINT64, decode, encode } from "."

function random(size: number) {
	const bytes = crypto.getRandomValues(new Uint8Array(size))
	const hex = "0x".concat(
		Array.from(bytes)
			.map((i) => i.toString(16).padStart(2, "0"))
			.join(""),
	)

	return BigInt(hex)
}

test("int64.encode should round-trip", function () {
	for (let size = 1; size <= 8; size++) {
		const n = random(size)
		const enc = encode(n)
		expect(decode(enc)).toBe(n)
	}
})

test("int64.encode should round-trip on max int", function () {
	const n = MAX_SAFE_BIGINT64
	const enc = encode(n)
	expect(decode(enc)).toBe(n)
})

test("int64.encode encodes 0 as array of zeroes", function () {
	const n = 0n
	const enc = encode(n)
	expect(enc).toStrictEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]))
})

test("int64.encode should throw for integers that are too large", function () {
	const n = random(9)
	expect(() => encode(n)).toThrow("only supports 64-bit integers")
})

test("int64.encode should throw for negative integers", function () {
	const n = -1
	expect(() => encode(n)).toThrow("only supports positive integers")
})

test("int64.decode should handle smaller arrays", function () {
	const buf = new Uint8Array([100, 200])
	expect(decode(buf)).toBe(100n + (200n << 8n))
})
