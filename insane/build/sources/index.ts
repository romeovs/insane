import { promises as fs } from "node:fs"

import { gqlPluckFromCodeString as pluck } from "@graphql-tools/graphql-tag-pluck"
import glob from "fast-glob"
import { concatMap } from "rxjs"

import { watch as watchFiles } from "~/build/files"
import { distinctUntilChanged } from "~/build/observable"
import type { DocumentNode } from "~/lib/document"
import { hash } from "~/lib/hash"
import { parse } from "~/lib/parser"

export type LoadSourcesOptions = {
	include?: string[]
	exclude?: string[]
}

export type Sources = {
	hash: string
	documents: DocumentNode[]
}

export async function load(options: LoadSourcesOptions): Promise<Sources> {
	const { include = ["**/*"], exclude } = options

	const files = await glob(include, {
		ignore: exclude,
	})

	const found = await Promise.all(files.map(loadFromFile))
	const documents = found
		.flat()
		.sort((a, b) => a.meta?.hash?.localeCompare(b.meta?.hash ?? "") ?? 0)
	const hashes = documents.map(({ meta }) => meta?.hash)

	return {
		hash: await hash(JSON.stringify(hashes)),
		documents,
	}
}

async function loadFromFile(filename: string): Promise<DocumentNode[]> {
	const code = await fs.readFile(filename, "utf-8")
	const plucked = await pluck(filename, code, {
		skipIndent: true,
	})

	return Promise.all(plucked.map((source) => parse(source)))
}

export function watch(options: LoadSourcesOptions) {
	return watchFiles(options).pipe(
		concatMap(() => load(options).catch((error: Error) => error)),
		distinctUntilChanged((a, b) => a.hash === b.hash),
	)
}
