import { sortExecutableDocument } from "@graphql-tools/documents"
import {
	optimizeDocumentNode,
	removeDescriptions,
	removeEmptyNodes,
	removeLoc,
} from "@graphql-tools/optimize"
import { optimizeDocuments } from "@graphql-tools/relay-operation-optimizer"

import {
	type DocumentNode,
	type FragmentDefinitionNode,
	type GraphQLSchema,
	Kind,
	print,
} from "graphql"

import type { Location, Sources } from "~/build/sources"

import { applySelectionSetFragmentArguments } from "./fragment-variables"
import { type SingleDefinitionDocumentNode, split } from "./split"
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
	const docs = split(
		await Promise.all(
			sources.sources.map((source) =>
				addOperationName(addInfo(source.raw.document, source.hash), source.hash),
			),
		),
	)

	const normalized = normalize(schema, docs)

	return {
		...sources,
		sources: normalized.filter(isOperation).map((document) => {
			const hash = getHash(document)
			const source = sources.sources.find((source) => source.hash === hash)
			if (!source) {
				throw new Error(`Could not find source for hash ${hash}`)
			}
			const doc = removeInfo(document)

			return {
				...source,
				name: getName(document),
				type: "operation",
				optimised: {
					document: doc,
					sdl: print(document),
				},
			}
		}),
		fragments: docs.filter(isFragment).map((document) => {
			return {
				name: getName(document),
				document,
			}
		}),
	}
}

function getDefinition(document: SingleDefinitionDocumentNode) {
	return document.definitions[0]
}

function isOperation(document: SingleDefinitionDocumentNode) {
	return getDefinition(document).kind === Kind.OPERATION_DEFINITION
}

function isFragment(document: SingleDefinitionDocumentNode) {
	return getDefinition(document).kind === Kind.FRAGMENT_DEFINITION
}

function getName(document: SingleDefinitionDocumentNode): string {
	return getDefinition(document).name?.value ?? ""
}

function normalize(schema: GraphQLSchema, docs: SingleDefinitionDocumentNode[]) {
	const fragments: Record<string, FragmentDefinitionNode> = docs
		.filter(isFragment)
		.reduce(
			(acc, doc) => ({
				...acc,
				[getName(doc)]: getDefinition(doc),
			}),
			{},
		)

	const inlined = docs.map((doc) =>
		applySelectionSetFragmentArguments(doc, fragments),
	)

	const flat = optimizeDocuments(schema, inlined, {
		includeFragments: true,
	})

	return split(
		flat.map(function (doc: DocumentNode) {
			const optimized = optimizeDocumentNode(doc, [
				removeEmptyNodes,
				removeDescriptions,
				removeLoc,
			])

			return sortExecutableDocument(optimized)
		}),
	)
}
