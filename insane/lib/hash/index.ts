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
	const { h64ToString } = await get()
	return h64ToString(source).toUpperCase()
}
