import { build as buildGraph } from "./graph"
import type { InsaneInput } from "./input"

export async function build(input: InsaneInput) {
	const graph = await buildGraph(input.config)

	return {
		...graph,
	}
}
