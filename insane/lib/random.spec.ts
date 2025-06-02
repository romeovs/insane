import { expect, test } from "vitest"
import { random } from "./random"

test("random should return a string", function () {
	const result = random()
	expect(typeof result).toBe("string")
})

test("random should return uppercase string", function () {
	const result = random()
	expect(result).toBe(result.toUpperCase())
})

test("random should return different values on consecutive calls", function () {
	const result1 = random()
	const result2 = random()
	expect(result1).not.toBe(result2)
})

test("random should only contain alphanumeric characters", function () {
	const result = random()
	expect(result).toMatch(/^[A-Z0-9]+$/)
})

test("random should return non-empty string", function () {
	const result = random()
	expect(result.length).toBeGreaterThan(0)
})

test("random should be consistently different across multiple calls", function () {
	const results = new Set()
	for (let i = 0; i < 100; i++) {
		results.add(random())
	}
	// Should have high uniqueness (allowing for small chance of collision)
	expect(results.size).toBeGreaterThan(95)
})