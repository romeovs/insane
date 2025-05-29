import { sortExecutableDocument } from "@graphql-tools/documents"
import {
	optimizeDocumentNode,
	removeDescriptions,
	removeEmptyNodes,
	removeLoc,
} from "@graphql-tools/optimize"
import { optimizeDocuments } from "@graphql-tools/relay-operation-optimizer"

import { type DocumentNode, type GraphQLSchema, Kind, print } from "graphql"

import type { Location, Sources } from "~/build/sources"

import {
	addInfo,
	addOperationName,
	getHash,
	removeInfo,
	removeOperationName,
} from "./utils"

export type OptimisedSource = {
	hash: string
	location: Location
	raw: {
		document: DocumentNode
		sdl: string
	}
	optimised: {
		document?: DocumentNode
		sdl?: string
	}
}

export type OptimisedSources = {
	hash: string
	sources: OptimisedSource[]
}

export async function optimise(
	schema: GraphQLSchema,
	sources: Sources,
): Promise<OptimisedSources> {
	const docs = sources.sources.map((source) =>
		addOperationName(addInfo(source.raw.document, source.hash)),
	)

	const byHash: Record<string, DocumentNode> = {}

	const normalized = normalize(schema, docs)
	for (const doc of normalized) {
		const hash = getHash(doc)
		const document = removeInfo(removeOperationName(doc))
		const isOperation = document.definitions[0]?.kind === Kind.OPERATION_DEFINITION

		if (isOperation) {
			byHash[hash] = document
		}
	}

	return {
		...sources,
		sources: sources.sources.map(function (source): OptimisedSource {
			const document = byHash[source.hash]

			return {
				...source,
				optimised: {
					document,
					sdl: document ? print(document) : "",
				},
			}
		}),
	}
}

function normalize(schema: GraphQLSchema, docs: DocumentNode[]): DocumentNode[] {
	const flat = optimizeDocuments(schema, docs, {
		includeFragments: true,
	})

	return flat.map(function (doc: DocumentNode) {
		const optimized = optimizeDocumentNode(doc, [
			removeEmptyNodes,
			removeDescriptions,
			removeLoc,
		])

		return sortExecutableDocument(optimized)
	})
}
