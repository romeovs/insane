import { expect, test } from "vitest"
import { UidEncoder } from "./encoder"

test("UidEncoder should round-trip", () => {
	const encoder = new UidEncoder("UFfRLVNbJHN/oGZ7ClrjYVZ6N4EEXhRU")

	const uids = [
		0n,
		1n,
		2n,
		3n,
		10n,
		100n,
		1000n,
		100000n,
		// postgres' maximum bigint (64 bits / 2)
		9223372036854775807n,

		// 64-bits
		18446744073709551616n - 1n,
	]

	for (const uid of uids) {
		const id = encoder.encode(uid)
		const decoded = encoder.decode(id)
		expect(decoded).toBe(uid)
		expect(encoder.decode(id.toLowerCase())).toBe(uid)
		expect(id.length).toBe(UidEncoder.UID_LENGTH)
	}
})

test("UidEncoder should return different results for different secrets", () => {
	const encoder1 = new UidEncoder("9PVgC+trLutmJdvuMazSooHj9u4MzYQy")
	const encoder2 = new UidEncoder("VhCQQsJHi7A+iwUhaVW7EHLm0QAfjxHH")

	const uid = 1n

	const id1 = encoder1.encode(uid)
	const id2 = encoder2.encode(uid)

	expect(id1).not.toBe(id2)
})

test("UidEncoder should reject invalid ids", () => {
	const encoder = new UidEncoder("UFfRLVNbJHN/oGZ7ClrjYVZ6N4EEXhRU")

	const id = "E5CDE3HB5LQQ69ZXV"
	expect(() => encoder.decode(id)).toThrow("Invalid id")
})
