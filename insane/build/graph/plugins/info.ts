import { DirectiveLocation, GraphQLDirective } from "graphql"
import { version } from "~/lib/version"

export const OperationInfoPlugin: GraphileConfig.Plugin = {
	name: "OperationInfoPlugin",
	description: "Operation info directive",
	version,
	schema: {
		hooks: {
			GraphQLSchema(schema, build) {
				const { GraphQLString } = build.graphql
				const context = new GraphQLDirective({
					name: "info",
					isRepeatable: false,
					locations: [
						DirectiveLocation.QUERY,
						DirectiveLocation.MUTATION,
						DirectiveLocation.FRAGMENT_DEFINITION,
					],
					args: {
						hash: {
							type: GraphQLString,
							description: "Add the query hash to the query",
						},
					},
				})

				schema.directives = [...(schema.directives ?? []), context]

				return schema
			},
		},
	},
}
