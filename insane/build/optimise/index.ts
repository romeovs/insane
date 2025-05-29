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

import { addInfo, addOperationName, getHash, removeInfo } from "./utils"

export type OptimisedSource = {
	hash: string
	location: Location
	type: "operation" | "fragment"
	name: string
	raw: {
		document: DocumentNode
		sdl: string
	}
	optimised: {
		document: DocumentNode
		sdl: string
	}
}

export type OptimisedSources = {
	hash: string
	sources: OptimisedSource[]
	fragments: {
		name: string
		document: DocumentNode
	}[]
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
		const document = removeInfo(doc)
		byHash[hash] = document
	}

	return {
		...sources,
		sources: sources.sources.flatMap(function (source): OptimisedSource[] {
			const document = byHash[source.hash]
			if (!document) {
				throw new Error(`Could not find document for hash ${source.hash}`)
			}

			const type = getType(document)
			if (type !== "operation") {
				return []
			}

			return [
				{
					...source,
					type,
					name: getName(document),
					optimised: {
						document,
						sdl: print(document),
					},
				},
			]
		}),
		fragments: normalized.flatMap((document) => {
			const type = getType(document)
			if (type !== "fragment") {
				return []
			}
			return [
				{
					name: getName(document),
					document,
				},
			]
		}),
	}
}

function getType(document: DocumentNode): "operation" | "fragment" {
	return document.definitions[0]?.kind === Kind.OPERATION_DEFINITION
		? "operation"
		: "fragment"
}

function getName(document: DocumentNode): string {
	const name = document.definitions[0]?.name?.value
	if (!name) {
		throw new Error("Document must have a name")
	}
	return name
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
