import { version } from "~/lib/version"
import type { DocumentsConnectionStep } from "./utils"

export const ConnectionArgsPlugin: GraphileConfig.Plugin = {
	name: "ConnectionArgsPlugin",
	description: "Adds connection arguments to connections",
	version,
	schema: {
		hooks: {
			GraphQLObjectType_fields_field_args(args, build, context) {
				if (!context.scope.connectionOf) {
					return args
				}
				const { GraphQLInt, GraphQLString } = build.graphql

				return build.extend(
					args,
					{
						first: {
							type: GraphQLInt,
							applyPlan(_, $documents: DocumentsConnectionStep, arg) {
								$documents.setFirst(arg.getRaw())
							},
						},
						last: {
							type: GraphQLInt,
							applyPlan(_, $documents: DocumentsConnectionStep, arg) {
								$documents.setLast(arg.getRaw())
							},
						},
						after: {
							type: GraphQLString,
							applyPlan(_, $documents: DocumentsConnectionStep, arg) {
								$documents.setAfter(arg.getRaw())
							},
						},
						before: {
							type: GraphQLString,
							applyPlan(_, $documents: DocumentsConnectionStep, arg) {
								$documents.setBefore(arg.getRaw())
							},
						},
					},
					`Add connection arguments to ${context.scope.fieldName}`,
				)
			},
		},
	},
}
