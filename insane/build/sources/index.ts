import { promises as fs } from "node:fs"

import { CodeFileLoader } from "@graphql-tools/code-file-loader"
import { loadDocuments } from "@graphql-tools/load"
import { concatMap } from "rxjs"

import { watch as watchFiles } from "~/build/files"
import { distinctUntilChanged } from "~/build/observable"
import { hash } from "~/lib/hash"

export type LoadSourcesOptions = {
	include?: string[]
	exclude?: string[]
}

export type Location = {
	filename: string
	line: number
	column: number
}

export type Source = {
	hash: string
	sdl: string
	location: Location
}

type FullSource = {
	rawSDL: string
	location: string
}

export type Sources = {
	hash: string
	sources: Source[]
}

export async function load(options: LoadSourcesOptions): Promise<Sources> {
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
					location: await locate(source.location, source.rawSDL),
					sdl: source.rawSDL,
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

export function watch(options: LoadSourcesOptions) {
	return watchFiles(options).pipe(
		concatMap(() => load(options).catch((error: Error) => error)),
		distinctUntilChanged((a, b) => a.hash === b.hash),
	)
}

async function locate(filename: string, sdl: string): Promise<Location> {
	const code = await fs.readFile(filename, "utf-8")
	const index = code.indexOf(sdl)

	const before = sdl.substring(0, index)
	const lines = before.split("\n")

	const line = lines.length
	const column = lines.at(-1)?.length ?? 0

	const relative = filename.replace(`${process.cwd()}/`, "")

	return {
		filename: relative,
		line,
		column,
	}
}
