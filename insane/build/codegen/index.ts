import { codegen } from "@graphql-codegen/core"
import * as typescript from "@graphql-codegen/typescript"
import * as typescriptOperations from "@graphql-codegen/typescript-operations"
import { pascalCase } from "change-case-all"
import { type GraphQLSchema, parse, printSchema } from "graphql"

import type { OptimisedSources } from "~/build/optimise"

function notNull<T>(x: T | null | undefined): x is T {
	return Boolean(x)
}

export async function generate(
	schema: GraphQLSchema,
	sources: OptimisedSources,
): Promise<string> {
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
	}

	let code = await codegen({
		documents: [
			...sources.sources.map((source) => source.optimised),
			...sources.fragments,
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
	code += buildTypeMap(sources)

	code += "\n\n"
	code += buildFragmentMap(sources)

	return code
}

function buildTypeMap(sources: OptimisedSources): string {
	let code = ""

	code += "export type TypeMap = {\n"
	for (const source of sources.sources) {
		if (source.type !== "operation") {
			continue
		}
		const result = `${pascalCase(source.name)}_QueryResult`
		const variables = `${pascalCase(source.name)}_QueryVariables`
		const key = JSON.stringify(source.raw.sdl)

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

function buildFragmentMap(sources: OptimisedSources): string {
	let code = ""

	code += "export type FragmentMap = {\n"
	for (const fragment of sources.fragments) {
		const result = pascalCase(`${pascalCase(fragment.name)}Fragment`)
		const variables = pascalCase(`${pascalCase(fragment.name)}FragmentVariables`)
		code += `  ${JSON.stringify(fragment.name)}: {
			result: ${result},
			variables: ${variables},
		},`
	}

	code += "}\n"

	return code
}
