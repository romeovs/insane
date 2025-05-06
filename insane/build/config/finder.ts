import { promises as fs } from "node:fs"

import { type Observable, concatMap, filter, fromEventPattern } from "rxjs"

import chokidar from "chokidar"

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

export function watch(options: FinderOptions): Observable<string> {
	const { candidates } = options

	const watcher = chokidar.watch(candidates, {
		ignored: ["**/.git", "**/node_modules"],
		persistent: true,
	})

	return fromEventPattern(
		function add(handler) {
			watcher.on("all", handler)
		},
		function remove(handler) {
			watcher.off("all", handler)
			watcher.close()
		},
		(_, pathname: string) => pathname,
	)
		.pipe(concatMap(() => find(options)))
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
