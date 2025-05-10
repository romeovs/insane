import { DirectiveLocation, GraphQLDirective, type GraphQLInputType } from "graphql"
import { english } from "~/lib/language"
import { version } from "~/lib/version"

export const ContextPlugin: GraphileConfig.Plugin = {
	name: "ContextPlugin",
	description: "Adds connection types for builtin scalars",
	version,
	schema: {
		hooks: {
			GraphQLSchema(schema, build) {
				const context = new GraphQLDirective({
					name: "context",
					description: "Set global properties of the query",
					isRepeatable: false,
					locations: [DirectiveLocation.QUERY, DirectiveLocation.MUTATION],
					args: {
						language: {
							type: build.getTypeByName("Language") as GraphQLInputType,
							description: "Only return content in this language",
							defaultValue: english.graphql,
						},
						status: {
							type: build.getTypeByName("Status") as GraphQLInputType,
							description: "Only return documents with this status",
							defaultValue: "LIVE",
						},
					},
				})

				schema.directives = [...(schema.directives ?? []), context]

				return schema
			},
		},
	},
}
