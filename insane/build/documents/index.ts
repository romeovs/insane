import { CodeFileLoader } from "@graphql-tools/code-file-loader"
import { loadDocuments } from "@graphql-tools/load"
import type { DocumentNode } from "graphql"
import { concatMap } from "rxjs"

import { watch as watchFiles } from "~/build//watch"

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

export function watch(options: LoadDocumentsOptions) {
	return watchFiles(options).pipe(concatMap(() => load(options)))
}
