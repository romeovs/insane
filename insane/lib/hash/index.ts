import xxhash from "xxhash-wasm"

let promise: ReturnType<typeof xxhash> | null = null

function get(): ReturnType<typeof xxhash> {
	if (!promise) {
		promise = xxhash()
	}
	return promise
}

/**
 * Create base-32 encoded sha-256 digest from the source string.
 */
export async function hash(source: string): Promise<string> {
	const { h64 } = await get()
	const digest = h64(source)
	return digest.toString(32).toUpperCase()
}
