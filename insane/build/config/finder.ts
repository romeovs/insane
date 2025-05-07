import { promises as fs } from "node:fs"

import { type Observable, concatMap, filter } from "rxjs"
import { watch as watchFiles } from "~/build/watch"

export type FinderOptions = {
	candidates: string[]
}

export async function find(options: FinderOptions) {
	const { candidates } = options

	const matches = await Promise.all(candidates.map(isFile))
	const filtered = matches.filter(Boolean)

	if (filtered.length > 1) {
		throw new Error(`conflicting config files found: ${filtered.join(", ")}`)
	}

	return filtered[0] ?? null
}

export function watch(options: FinderOptions): Observable<string | Error> {
	const { candidates } = options

	return watchFiles({ include: candidates })
		.pipe(concatMap(() => find(options).catch((err: Error) => err)))
		.pipe(filter(Boolean))
}

async function isFile(filename: string) {
	try {
		const stat = await fs.stat(filename)
		return stat.isFile() ? filename : null
	} catch (err) {
		return null
	}
}
