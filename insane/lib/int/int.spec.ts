import { expect, test } from "vitest"
import { decode, encode } from "."

function random(size: number) {
	const bytes = crypto.getRandomValues(new Uint8Array(size))
	const hex = "0x".concat(
		Array.from(bytes)
			.map((i) => i.toString(16).padStart(2, "0"))
			.join(""),
	)

	return BigInt(hex)
}

test("int.encode should round-trip", function () {
	for (let size = 1; size <= 10; size++) {
		const n = random(size)
		const enc = encode(n)
		expect(decode(enc)).toBe(n)
	}
})

test("int.encode encodes 0 as array of zeroes", function () {
	const n = 0n
	const enc = encode(n)
	expect(enc).toStrictEqual(new Uint8Array([0]))
})

test("int.encode should throw for negative integers", function () {
	const n = -1n
	expect(() => encode(n)).toThrow("only supports positive integers")
})
