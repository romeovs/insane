import { CodeFileLoader } from "@graphql-tools/code-file-loader"
import { loadDocuments } from "@graphql-tools/load"
import chokidar, { type FSWatcher } from "chokidar"
import type { DocumentNode } from "graphql"

export type LoadDocumentsOptions = {
	include: string[]
	exclude?: string[]
}

type Source = {
	document?: DocumentNode
	rawSDL?: string
	location?: string
}

export async function load(options: LoadDocumentsOptions): Promise<Source[]> {
	const { include, exclude } = options

	const sources = await loadDocuments(include, {
		ignore: exclude,
		loaders: [
			new CodeFileLoader({
				pluckConfig: {
					skipIndent: true,
				},
			}),
		],
	})

	return sources
}

export async function* watch(
	options: LoadDocumentsOptions & { signal?: AbortSignal },
): AsyncGenerator<Source[]> {
	const { include, exclude, signal } = options

	signal?.addEventListener("abort", () => watcher.close())

	const watcher = chokidar.watch(include, {
		ignored: exclude,
		persistent: true,
	})

	for (;;) {
		await wait(watcher, signal)
		const sources = await load(options)
		yield sources
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
