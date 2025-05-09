import Sqids from "sqids"
import * as int from "~/lib/int64"

const alphabet = "34ACDEFHJLMNPRTXY"
const len = 22

export type Encoding = {
	encode(x: Uint8Array): string
	decode(x: string): Uint8Array
}

export class SqidsEncoder {
	#sqids: Sqids
	#len: number

	constructor() {
		this.#sqids = new Sqids({
			minLength: len,
			alphabet,
		})
		this.#len = len
	}

	encode(buf: Uint8Array): string {
		if (buf.length > 10) {
			throw new Error(`Invalid buffer length: ${buf.length}`)
		}

		// split the arr 5-byte slices
		const lo = buf.slice(0, 5)
		const hi = buf.slice(5)

		// encode the parts as numbers
		const arr = [decodeInt(lo), decodeInt(hi)]

		// encode the numbers using Sqids
		const encoded = this.#sqids.encode(arr)

		return encoded
	}

	decode(str: string): Uint8Array {
		// ensure the length is valid
		if (str.length !== this.#len) {
			throw new Error("Invalid id")
		}

		// decode the id
		const arr = this.#sqids.decode(str.toUpperCase())
		if (arr.length !== 2) {
			throw new Error("Invalid id")
		}

		const lo = encodeInt(arr[0]!)
		const hi = encodeInt(arr[1]!)

		const buf = new Uint8Array([...lo, ...hi])

		return buf
	}
}

function shift(number: number, shift: number): number {
	return number * 2 ** shift
}

function encodeInt(number: number): Uint8Array {
	const decoded = []
	let num = number
	while (decoded.length < 5) {
		decoded.push(num & 0xff)
		num = shift(num, -8)
	}
	return new Uint8Array(decoded)
}

function decodeInt(buf: Uint8Array): number {
	let encoded = 0

	for (let i = 0; i < buf.length; i++) {
		encoded += shift(buf[i]!, i * 8)
	}

	return encoded
}

const encoder = new SqidsEncoder()

export function encode(buf: Uint8Array | number | bigint): string {
	const buf_ = buf instanceof Uint8Array ? buf : int.encode(buf)
	return encoder.encode(buf_)
}

export function decode(str: string): Uint8Array {
	return encoder.decode(str)
}
