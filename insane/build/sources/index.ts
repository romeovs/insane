import { promises as fs } from "node:fs"

import { gqlPluckFromCodeString as pluck } from "@graphql-tools/graphql-tag-pluck"
import glob from "fast-glob"
import type { DocumentNode } from "graphql"
import { concatMap } from "rxjs"

import { watch as watchFiles } from "~/build/files"
import { distinctUntilChanged } from "~/build/observable"
import { hash } from "~/lib/hash"
import { parse } from "~/lib/parser"

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

	const files = await glob(include, {
		ignore: exclude,
	})

	const found = await Promise.all(files.map(loadFromFile))
	const sources = found.flat().sort((a, b) => a.hash.localeCompare(b.hash))
	const hashes = sources.map((source) => source.hash)

	const result = {
		hash: await hash(JSON.stringify(hashes)),
		sources,
	}

	return result
}

async function loadFromFile(filename: string): Promise<Source[]> {
	const code = await fs.readFile(filename, "utf-8")
	const plucked = await pluck(filename, code, {
		skipIndent: true,
	})

	return Promise.all(
		plucked.map(async (item) => ({
			hash: await hash(item.body),
			location: {
				filename,
				line: item.locationOffset.line,
				column: item.locationOffset.column,
			},
			raw: {
				sdl: item.body,
				document: await parse(item),
			},
		})),
	)
}

export function watch(options: LoadSourcesOptions) {
	return watchFiles(options).pipe(
		concatMap(() => load(options).catch((error: Error) => error)),
		distinctUntilChanged((a, b) => a.hash === b.hash),
	)
}
