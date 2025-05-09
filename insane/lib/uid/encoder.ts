import { BinaryFF1 } from "@noble/ciphers/ff1"
import { type Encoding, SqidsEncoder } from "~/lib/encode"
import * as int64 from "~/lib/int64"

import { crc16 } from "./crc"

const max = int64.MAX_SAFE_BIGINT64
const len = 22

type Encryption = {
	encrypt(x: Uint8Array): Uint8Array
	decrypt(x: Uint8Array): Uint8Array
}

/**
 * UidEncoder takes any number between 0 and MAX_SAFE_BIGINT64
 * and encodes it as a 22-character string.
 *
 * The alphabet of this string is chosen to avoid transcribing errors.
 *
 * The resulting uid is encrypted using the key passed to the UidEncoder constructor,
 * so the id is not easily reversible and can be exposed publicly.
 *
 * Additionally, the uid includes a crc16 checksum to avoid further tampering
 * and to warn users of transcription errors.
 */
export class UidEncoder {
	#encoding: Encoding
	#encryption: Encryption

	static MAX_SAFE_ID = max
	static UID_LENGTH = len

	/**
	 * Construct a uid encoder. This encoder is safe to reuse.
	 *
	 * @param key -
	 *   A secret key used to make the uid unguessable and safe to publicly expose.
	 *   Do not share this key with anyone.
	 */
	constructor(key: string) {
		this.#encoding = new SqidsEncoder()
		this.#encryption = BinaryFF1(new TextEncoder().encode(key))
	}

	/**
	 * Encode a number as a uid.
	 *
	 * @param num -
	 *	The number to encode as a uid, this will accept anything that can
	 *	be passed to BigInt and lead to a valid number.
	 *	The maximum value of this number can be UidEncoder.MAX_SAFE_BIGINT64.
	 * @returns -
	 *	The encoded uid.
	 */
	encode(num: number | bigint | string): string {
		const number = BigInt(num)

		if (number < 0 || number > max) {
			throw new Error("Uid only supports numbers up to 64-bits")
		}

		// encode the number as a Uint8Array
		const buf = int64.encode(number)

		// calculate the buffer checksum
		const sum = crc16(buf)

		// create a checked buffer
		const checked = new Uint8Array([...sum, ...Array.from(buf)])

		// encrypt the binary number
		const encrypted = this.#encryption.encrypt(checked)

		return this.#encoding.encode(encrypted)
	}

	/**
	 * Decode a uid into its corresponfing bigint.
	 *
	 * This will perform the decryption and crc-check to make sure the
	 * input has not been tampered with.
	 *
	 * This only works on uids that where generated with the same key.
	 *
	 * @param uid -
	 *	The uid to decode.
	 * @returns -
	 *	The decoded number.
	 */
	decode(uid: string): bigint {
		const encrypted = this.#encoding.decode(uid)

		// decrypt the checked message
		const checked = this.#encryption.decrypt(encrypted)

		// split the messge into checksum and buffer
		const buf = checked.slice(2)
		const sum = crc16(buf)

		// validate the checksum
		if (sum[0] !== checked[0] || sum[1] !== checked[1]) {
			throw new Error("Invalid id")
		}

		// decode the buffer into a bigint
		const number = int64.decode(buf)

		if (number > max) {
			throw new Error("Invalid id")
		}

		return number
	}
}
