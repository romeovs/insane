import { TYPES } from "@dataplan/pg"
import { EXPORTABLE } from "graphile-utils"
import { sql } from "pg-sql2"

import { version } from "~/lib/version"

export const TotalCountPlugin: GraphileConfig.Plugin = {
	name: "TotalCountPlugin",
	description: "Adds Document type",
	version,
	schema: {
		hooks: {
			GraphQLObjectType_fields(fields, build, context) {
				const {
					extend,
					graphql: { GraphQLInt, GraphQLNonNull },
				} = build

				const {
					scope: { isConnectionType },
					fieldWithHooks,
				} = context

				if (!isConnectionType) {
					return fields
				}

				return extend(
					fields,
					{
						totalCount: fieldWithHooks(
							{
								fieldName: "totalCount",
							},
							() => ({
								type: new GraphQLNonNull(GraphQLInt),
								description:
									"The total number of all nodes you could get from this connection.",
								plan: EXPORTABLE(
									(TYPES, sql) => ($connection) => {
										return $connection
											.cloneSubplanWithoutPagination("aggregate")
											.singleAsRecord()
											.select(sql`count(*)`, TYPES.bigint)
									},
									[TYPES, sql],
								),
							}),
						),
					},
					"Add totalCount to connections.",
				)
			},
		},
	},
}
