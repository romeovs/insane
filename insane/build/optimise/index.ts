import { sortExecutableDocument } from "@graphql-tools/documents"
import {
	optimizeDocumentNode,
	removeDescriptions,
	removeEmptyNodes,
	removeLoc,
} from "@graphql-tools/optimize"
import { optimizeDocuments } from "@graphql-tools/relay-operation-optimizer"

import {
	type ArgumentNode,
	type DocumentNode,
	type FragmentDefinitionNode,
	type GraphQLSchema,
	type InlineFragmentNode,
	Kind,
	print,
	visit,
} from "graphql"

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
			const type = getType(source.raw.document)
			if (type !== "operation") {
				return []
			}

			const document = byHash[source.hash]
			if (!document) {
				throw new Error(`Could not find document for hash ${source.hash}`)
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

			// TODO: some fragments are missing due to optimiseDocuments
			// removing unused fragments (and they seem unused because we might've inlined them)
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
	const operation = getOperation(document)
	return operation ? "operation" : "fragment"
}

function getName(document: DocumentNode): string {
	const operation = getOperation(document)
	if (operation) {
		return operation.name?.value ?? ""
	}

	const fragment = getFragment(document)
	return fragment?.name?.value ?? ""
}

function getOperation(document: DocumentNode) {
	const operations = document.definitions.filter(
		(def) => def.kind === Kind.OPERATION_DEFINITION,
	)
	if (operations.length > 1) {
		throw new Error("Query must have only one operation")
	}

	return operations[0]
}

function getFragment(document: DocumentNode) {
	const fragments = document.definitions.filter(
		(def) => def.kind === Kind.FRAGMENT_DEFINITION,
	)
	return fragments[0]
}

function normalize(schema: GraphQLSchema, docs: DocumentNode[]): DocumentNode[] {
	const fragments: Record<string, FragmentDefinitionNode> = {}
	for (const doc of docs) {
		for (const def of doc.definitions) {
			if (def.kind === Kind.FRAGMENT_DEFINITION) {
				fragments[def.name.value] = def
			}
		}
	}

	const inlined = docs.map((doc) =>
		applySelectionSetFragmentArguments(doc, fragments),
	)

	const flat = optimizeDocuments(schema, inlined, {
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

export function applySelectionSetFragmentArguments(
	document: DocumentNode,
	fragments: Record<string, FragmentDefinitionNode>,
): DocumentNode {
	return visit(document, {
		FragmentSpread(fragmentNode) {
			// @ts-expect-error
			if (fragmentNode.arguments?.length >= 1) {
				const fragment = fragments[fragmentNode.name.value]
				if (!fragment) {
					throw new Error(`Unknown fragment ${fragmentNode.name.value}`)
				}

				const args: Record<string, ArgumentNode> = {}
				// @ts-expect-error
				for (const arg of fragmentNode.arguments) {
					args[arg.name.value] = arg
				}

				// TODO: allow nested fragments with arguments?

				const selectionSet = visit(fragment.selectionSet, {
					Variable(variableNode) {
						const arg = args[variableNode.name.value]
						if (arg) {
							return arg.value
						}

						return variableNode
					},
				})

				return {
					kind: Kind.INLINE_FRAGMENT,
					typeCondition: fragment.typeCondition,
					selectionSet,
				} as InlineFragmentNode
			}
		},
	})
}
