import { codegen } from "@graphql-codegen/core"
import * as typescript from "@graphql-codegen/typescript"
import * as typescriptOperations from "@graphql-codegen/typescript-operations"
import { pascalCase } from "change-case-all"
import {
	type FragmentDefinitionNode,
	type GraphQLSchema,
	type OperationDefinitionNode,
	parse,
	printSchema,
} from "graphql"
import {
	type FragmentDocumentNode,
	type OperationDocumentNode,
	type SingleDefinitionDocumentNode,
	getName,
	isFragment,
	isOperation,
} from "~/lib/document"

export async function generate({
	schema,
	operations,
	fragments,
}: {
	schema: GraphQLSchema
	operations: SingleDefinitionDocumentNode<OperationDefinitionNode>[]
	fragments: SingleDefinitionDocumentNode<FragmentDefinitionNode>[]
}): Promise<string> {
	const config = {
		documentMode: "documentNodeImportFragments",
		optimizeDocumentNode: true,
		dedupeFragments: true,
		exportFragmentSpreadSubTypes: true,
		enumsAsTypes: true,
		preResolveTypes: true,
		immutableTypes: true,
		dedupeOperationSuffix: true,
		declarationKind: "type",
		pureMagicComment: true,
		operationResultSuffix: "Result",
		useImplementingTypes: true,
		experimentalFragmentVariables: true,
		strictScalars: true,
		printFieldsOnNewLines: true,
		scalars: {
			DateTime: "Date",
			Cursor: "string",
		},
		namingConvention: {
			typeNames: "keep",
			removeUnderscores: false,
		},
	}

	let code = await codegen({
		documents: [
			...operations.map((document) => ({ document, hash: document.meta?.hash })),
			...fragments.map((document) => ({ document, hash: document.meta?.hash })),
		],
		filename: ".insane/generated/types.ts",
		pluginMap: {
			typescript,
			typescriptOperations,
		},
		config: {},
		plugins: [
			{
				typescript: config,
			},
			{
				typescriptOperations: config,
			},
		],
		schema: parse(printSchema(schema)),
	})

	code += "\n\n"
	code += buildTypeMap(operations)

	code += "\n\n"
	code += buildFragmentMap(fragments)

	return code
}

function buildTypeMap(operations: OperationDocumentNode[]): string {
	let code = ""

	code += "export type TypeMap = {\n"
	for (const operation of operations) {
		if (!isOperation(operation)) {
			continue
		}

		const name = getName(operation)
		const result = `${name}QueryResult`
		const variables = `${name}QueryVariables`
		const key = JSON.stringify(operation.loc?.source?.body)

		code += `
			${key}: {
				result: ${result}
				variables: ${variables}
			}
		`
	}
	code += "}"

	return code
}

function buildFragmentMap(fragments: FragmentDocumentNode[]): string {
	let code = ""

	code += "export type FragmentMap = {\n"
	for (const fragment of fragments) {
		if (!isFragment(fragment)) {
			continue
		}

		const name = getName(fragment)
		const result = pascalCase(`${pascalCase(name)}Fragment`)
		const variables = pascalCase(`${pascalCase(name)}FragmentVariables`)
		code += `  ${JSON.stringify(name)}: {
			result: ${result},
			variables: ${variables},
		},`
	}

	code += "}\n"

	return code
}
