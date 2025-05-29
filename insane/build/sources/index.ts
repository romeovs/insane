import { promises as fs } from "node:fs"

import { CodeFileLoader } from "@graphql-tools/code-file-loader"
import { loadDocuments } from "@graphql-tools/load"
import { concatMap } from "rxjs"

import type { DocumentNode } from "graphql"
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
	location: Location
	raw: {
		sdl: string
		document: DocumentNode
	}
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
		sources.map(async function (source) {
			if (!source.location) {
				throw new Error("Missing source location")
			}
			if (!source.rawSDL) {
				throw new Error("Missing source sdl")
			}
			if (!source.document) {
				throw new Error("Missing source document")
			}
			return {
				hash: await hash(source.rawSDL),
				location: await locate(source.location, source.rawSDL),
				raw: {
					sdl: source.rawSDL,
					document: source.document,
				},
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
