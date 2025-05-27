import type { PgSelectQueryBuilderCallback } from "@dataplan/pg"
import { connection, constant, lambda } from "grafast"
import { EXPORTABLE } from "graphile-utils"
import type { GraphQLFieldConfigMap } from "graphql"
import { sql } from "pg-sql2"
import { decode } from "~/lib/uid/plan"
import { version } from "~/lib/version"
import { track, trackEach, trackList } from "./track"
import type { DocumentStep } from "./utils"

export const QueryTypesPlugin: GraphileConfig.Plugin = {
	name: "QueryTypesPlugin",
	description: "Adds query fields for user-defined types",
	version,
	schema: {
		hooks: {
			GraphQLObjectType_fields(fields, build, context) {
				if (!context.scope.isRootQuery) {
					return fields
				}

				const { GraphQLID, GraphQLNonNull } = build.graphql

				const flds: GraphQLFieldConfigMap<unknown, unknown> = {}

				for (const type of build.input.config.types) {
					const { type: typeName, singular, plural } = type.names.graphql
					flds[singular] = context.fieldWithHooks(
						{
							fieldName: singular,
							insane: {
								type,
							},
						},
						() => ({
							name: singular,
							description: `Get a single ${singular}.`,
							type: build.getOutputTypeByName(typeName),
							args: {
								id: {
									type: GraphQLID,
									applyPlan: EXPORTABLE(
										(decode, lambda, sql) => (_, $document: DocumentStep, arg) => {
											const $condition = lambda(
												decode(arg.getRaw()),
												(value): PgSelectQueryBuilderCallback =>
													(qb) => {
														if (value !== undefined) {
															qb.where(sql`${qb.alias}.uid = ${sql.value(value)}`)
														}
													},
											)
											$document.getClassStep().apply($condition)
										},
										[decode, lambda, sql],
									),
								},
							},
							plan: EXPORTABLE(
								(document, constant, type, track) => () => {
									const $document = document
										.find({ type: constant(type.name) })
										.single()

									track($document)
									return $document
								},
								[build.input.pgRegistry.pgResources.document, constant, type, track],
							),
							extensions: {
								directives: {
									oneOf: {},
								},
							},
						}),
					)

					flds[plural] = context.fieldWithHooks(
						{
							fieldName: plural,
							insane: {
								type,
								connectionOf: type,
							},
						},
						// @ts-expect-error
						() => ({
							name: plural,
							description: `Get ${plural} based on the provided filters.`,
							type: new GraphQLNonNull(
								build.getObjectTypeByName(`${typeName}Connection`),
							),
							plan: EXPORTABLE(
								(type, pgRegistry, connection, trackList, trackEach) => () => {
									const $documents = pgRegistry.pgResources.document.find({ type })
									trackList(type)
									trackEach($documents)
									return connection($documents)
								},
								[
									type.name,
									build.input.pgRegistry,
									connection,
									trackList,
									trackEach,
								],
							),
						}),
					)
				}

				return build.extend(fields, flds, "Add type-specific fields to Query")
			},
		},
	},
}
