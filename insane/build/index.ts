import { generate } from "./codegen"
import { type InsaneOutput, build as buildGraph } from "./graph"
import type { InsaneInput } from "./input"
import { type OptimisedSources, optimise } from "./optimise"

export type BuildOutput = {
	schema: InsaneOutput
	queries: OptimisedSources
	types: string
}

export async function build(input: InsaneInput): Promise<BuildOutput> {
	const schema = await buildGraph(input.config)
	const queries = await optimise(schema.schema, input.sources)
	const types = await generate(schema.schema, queries)

	return {
		schema,
		queries,
		types,
	}
}
