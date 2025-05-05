import { promises as fs } from "node:fs"

import chokidar, { type FSWatcher } from "chokidar"

export type FinderOptions = {
	candidates: string[]
	signal?: AbortSignal
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

export async function* watch(options: FinderOptions): AsyncGenerator<string> {
	const { candidates, signal } = options

	const watcher = chokidar.watch(candidates, {
		ignored: ["**/.git", "**/node_modules"],
		ignoreInitial: true,
		persistent: true,
	})

	signal?.addEventListener("abort", () => watcher.close())

	let current = null

	const found = await find(options)
	if (found) {
		current = found
		yield found
	}

	for (;;) {
		try {
			await wait(watcher)

			const found = await find(options)
			if (found && found !== current) {
				current = found
				yield found
			}
		} catch (err) {
			if (err === undefined) {
				return
			}
			throw err
		}
		// TODO: should we catch and handler errors?
	}
}

async function isFile(filename: string) {
	try {
		const stat = await fs.stat(filename)
		return stat.isFile() ? filename : null
	} catch (err) {
		return null
	}
}

async function wait(watcher: FSWatcher, signal?: AbortSignal) {
	await new Promise(function (resolve, reject) {
		function handler() {
			watcher.off("all", handler)
			signal?.removeEventListener("abort", reject)
			resolve(null)
		}
		watcher.on("all", handler)
		signal?.addEventListener("abort", reject)
	})
}
