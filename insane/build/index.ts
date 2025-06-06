import type { SingleDefinitionDocumentNode } from "~/lib/document"
import { generate } from "./codegen"
import { type InsaneOutput, build as graph } from "./graph"
import type { InsaneInput } from "./input"

import type { FragmentDefinitionNode, OperationDefinitionNode } from "graphql"
import { optimise } from "~/lib/optimise"

export type BuildOutput = {
	schema: InsaneOutput
	operations: SingleDefinitionDocumentNode<OperationDefinitionNode>[]
	fragments: SingleDefinitionDocumentNode<FragmentDefinitionNode>[]
	types: string
}

export async function build(input: InsaneInput): Promise<BuildOutput> {
	const schema = await graph(input.config)
	const documents = input.sources.sources.map((source) => source.raw.document)
	const { operations, fragments } = await optimise(schema.schema, documents)
	const types = await generate({ schema: schema.schema, operations, fragments })

	return {
		schema,
		operations,
		fragments,
		types,
	}
}
