import { CodeFileLoader } from "@graphql-tools/code-file-loader"
import { loadDocuments } from "@graphql-tools/load"
import { concatMap } from "rxjs"

import { distinctUntilChanged } from "~/build/observable"
import { watch as watchFiles } from "~/build/watch"
import { hash } from "~/lib/hash"

export type LoadDocumentsOptions = {
	include?: string[]
	exclude?: string[]
}

export type Source = {
	hash: string
	sdl: string
	location: string
}

type FullSource = {
	rawSDL: string
	location: string
}

export type Sources = {
	hash: string
	sources: Source[]
}

export async function load(options: LoadDocumentsOptions): Promise<Sources> {
	const { include = ["**/*"], exclude } = options

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

	const hashed = await Promise.all(
		sources
			.filter((source): source is FullSource =>
				Boolean(source.rawSDL && source.location),
			)
			.map(async function (source) {
				return {
					hash: await hash(source.rawSDL),
					sdl: source.rawSDL,
					location: source.location,
				}
			}),
	)

	const hashes = hashed.map((source) => source.hash).sort()

	const result = {
		hash: await hash(JSON.stringify(hashes)),
		sources: hashed,
	}

	return result
}

export function watch(options: LoadDocumentsOptions) {
	return watchFiles(options).pipe(
		concatMap(() => load(options).catch((error: Error) => error)),
		distinctUntilChanged((a, b) => a.hash === b.hash),
	)
}
