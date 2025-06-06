import { sortExecutableDocument } from "@graphql-tools/documents"
import {
	optimizeDocumentNode,
	removeDescriptions,
	removeEmptyNodes,
	removeLoc,
} from "@graphql-tools/optimize"
import { optimizeDocuments } from "@graphql-tools/relay-operation-optimizer"

import {
	type ExecutableDefinitionNode,
	type FragmentDefinitionNode,
	type GraphQLSchema,
	print,
} from "graphql"

import {
	type DocumentNode,
	type FragmentDocumentNode,
	type OperationDocumentNode,
	type SingleDefinitionDocumentNode,
	getDefinition,
	getName,
	isFragment,
	isOperation,
} from "~/lib/document"
import { hash as hash_ } from "~/lib/hash"

import { applySelectionSetFragmentArguments } from "./fragment-variables"
import { split } from "./split"
import { addInfo, addOperationName } from "./utils"

/**
 * Optimise the documents.
 *
 * The following optimisations are applied:
 *
 * - applying fragment arguments
 * - inlining fragments
 * - flattening the document
 * - remove empty nodes
 *
 * Returns the optimised documents as an array of
 * single definition documents.
 */
export async function optimise(
	schema: GraphQLSchema,
	documents: DocumentNode[],
): Promise<{
	operations: OperationDocumentNode[]
	fragments: FragmentDocumentNode[]
}> {
	const docs = split(
		await Promise.all(
			documents.map(async function (document) {
				const hash = document?.meta?.hash ?? (await hash_(print(document)))
				return addOperationName(addInfo(document, hash), hash)
			}),
		),
	)

	const fragmentMap: Record<string, FragmentDefinitionNode> = docs
		.filter(isFragment)
		.reduce(
			(acc, doc) => ({
				...acc,
				[getName(doc)]: getDefinition(doc),
			}),
			{},
		)

	const inlined = docs.map((doc) =>
		applySelectionSetFragmentArguments(doc, fragmentMap),
	)

	const optimised = optimizeDocuments(schema, inlined, {
		includeFragments: true,
	})

	const normalized = split(
		optimised.map(function (doc: DocumentNode) {
			const optimized = optimizeDocumentNode(doc, [
				removeEmptyNodes,
				removeDescriptions,
				removeLoc,
			])

			return sortExecutableDocument(optimized)
		}),
	)

	const operations = await Promise.all(
		normalized
			.filter(isOperation)
			.map(function (document) {
				const original = docs.find((doc) => getName(doc) === getName(document))
				if (!original) {
					throw new Error("Missing original")
				}

				document.loc = original?.loc
				return document
			})
			.map(addMeta),
	)

	const fragments = await Promise.all(docs.filter(isFragment).map(addMeta))

	return {
		operations,
		fragments,
	}
}

async function addMeta<T extends ExecutableDefinitionNode>(
	document: SingleDefinitionDocumentNode<T>,
): Promise<SingleDefinitionDocumentNode<T>> {
	document.meta ??= {}
	document.meta.hash = document.meta.hash ?? (await hash_(print(document)))
	return document
}
