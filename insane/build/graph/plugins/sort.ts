import type { FieldArg } from "grafast"
import type { GraphQLEnumValueConfig } from "graphql"
import { sql } from "pg-sql2"

import { isSimpleType } from "~/config"
import { version } from "~/lib/version"

import { type PgSelectQueryBuilder, TYPES } from "@dataplan/pg"
import { EXPORTABLE } from "graphile-build"
import type { DocumentsConnectionStep } from "./utils"

export const SortArgsPlugin: GraphileConfig.Plugin = {
	name: "SortArgsPlugin",
	description: "Adds arguments for sorting connections",
	version,
	schema: {
		hooks: {
			init(_, build) {
				for (const type of build.input.config.types) {
					const values: { [key: string]: GraphQLEnumValueConfig } = {}
					for (const field of type.fields) {
						for (const direction of ["ASC" as const, "DESC" as const]) {
							if (isSimpleType(field.type)) {
								values[`${field.name.toUpperCase()}_${direction}`] = {
									value: `${field.name}_${direction.toLowerCase()}`,
									description: `Sort ascending by ${field.name}`,
									extensions: {
										grafast: {
											apply: EXPORTABLE(
												(sql, TYPES, fieldName, direction) =>
													(qb: PgSelectQueryBuilder) => {
														qb.orderBy({
															fragment: sql`data->${sql.literal(fieldName)}`,
															codec: TYPES.jsonb,
															direction,
														})
													},
												[sql, TYPES, field.name, direction],
											),
										},
									},
								}
							}
						}
					}

					build.registerEnumType(
						`${type.names.graphql.type}Sort`,
						{},
						() => ({
							values,
						}),
						`Add ${type.names.graphql.type}Sort enum`,
					)
				}

				return _
			},
			GraphQLObjectType_fields_field_args(args, build, context) {
				const type = context.scope.connectionOf
				if (!type || type === true) {
					return args
				}

				return build.extend(
					args,
					{
						orderBy: {
							type: build.getInputTypeByName(`${type.names.graphql.type}Sort`),
							applyPlan: (
								_,
								$connection: DocumentsConnectionStep,
								arg: FieldArg,
							) => {
								const $select = $connection.getSubplan()
								arg.apply($select)
							},
						},
					},
					`Add filters for ${context.scope.fieldName}`,
				)
			},
		},
	},
}
