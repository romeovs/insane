import type { PgSelectQueryBuilderCallback } from "@dataplan/pg"
import {
	type FieldArg,
	type GrafastFieldConfigArgumentMap,
	type GrafastInputFieldConfigMap,
	lambda,
} from "grafast"
import { EXPORTABLE } from "graphile-utils"
import type { GraphQLInputType } from "graphql"
import { classify } from "inflection"
import { sql } from "pg-sql2"

import type { InsaneType } from "~/lib/schema"
import { version } from "~/lib/version"

import type { DocumentStep } from "./document"
import { field } from "./util"

export const UniquesPlugin: GraphileConfig.Plugin = {
	name: "UniquesPlugin",
	description: "Adds arguments for getting types by unique values",
	version,
	schema: {
		hooks: {
			init(_, build) {
				for (const type of build.input.config.types) {
					for (const name in type.uniques) {
						const unique = type.uniques[name]!

						const fields: GrafastInputFieldConfigMap<unknown> = {}

						for (const fieldName of unique) {
							const field = type.fields.find((field) => field.name === fieldName)
							if (!field) {
								throw new Error(`no field ${fieldName} in ${type.name}`)
							}
							fields[field.name] = {
								type: graphQLInputType(build, field),
							}
						}

						const size = Object.keys(fields).length
						if (size === 1) {
							// nothing to do, we can just use the literal type
							// TODO: should we make sure it's a literal type?
						} else {
							build.registerInputObjectType(
								inputTypeName(type, name),
								{},
								() => ({
									fields,
								}),
								`Add input type for ${name}`,
							)
						}
					}
				}

				return _
			},
			GraphQLObjectType_fields_field_args(args, build, context) {
				if (context.Self.name !== "Query") {
					return args
				}

				const extended: GrafastFieldConfigArgumentMap = {}

				for (const type of build.input.config.types) {
					if (type.names.graphql.singular === context.scope.fieldName) {
						for (const name in type.uniques) {
							const unique = type.uniques[name]!

							const types = unique.map(function (fieldName) {
								const field = type.fields.find((field) => field.name === fieldName)
								if (!field) {
									throw new Error(`no field ${fieldName} in ${type.name}`)
								}
								return graphQLInputType(build, field)
							})

							if (types.length === 1) {
								const fieldName = unique[0]
								const fieldType = types[0]
								if (!fieldName || !fieldType) {
									throw new Error(`missing field ${unique[0]} in ${type.name}`)
								}

								extended[name] = {
									type: fieldType,
									applyPlan: EXPORTABLE(
										(fieldName, sql, lambda, field) =>
											(_: unknown, $document: DocumentStep, arg: FieldArg) => {
												const $condition = lambda(
													arg.getRaw(),
													(value): PgSelectQueryBuilderCallback =>
														function (qb) {
															if (value === undefined || value === null) {
																return
															}
															qb.where(
																sql`${field(qb, fieldName)} = ${sql.value(value)}`,
															)
														},
												)
												$document.getClassStep().apply($condition)
											},
										[fieldName, sql, lambda, field],
									),
								}
							} else {
								const inputType = build.getInputTypeByName(inputTypeName(type, name))
								extended[name] = {
									type: inputType,
									applyPlan: EXPORTABLE(
										(fieldNames, sql, lambda, field) =>
											(_: unknown, $document: DocumentStep, arg: FieldArg) => {
												const $conditions = lambda(
													arg.getRaw(),
													(value): PgSelectQueryBuilderCallback =>
														function (qb) {
															if (value === undefined) {
																return
															}
															for (const fieldName of fieldNames) {
																const val = value[fieldName]
																if (val === undefined || val === null) {
																	qb.where(sql`${field(qb, fieldName)} is null`)
																} else {
																	qb.where(
																		sql`${field(qb, fieldName)} = ${sql.value(val)}`,
																	)
																}
															}
														},
												)
												$document.getClassStep().apply($conditions)
											},
										[unique, sql, lambda, field],
									),
								}
								return build.extend(args, extended, `Add uniques for ${type.name}`)
							}
						}
					}
				}

				return args
			},
		},
	},
}

function graphQLInputType(
	build: GraphileBuild.Build,
	{ type, required }: { type: string; required?: boolean },
): GraphQLInputType {
	const { GraphQLString, GraphQLInt, GraphQLBoolean, GraphQLFloat, GraphQLNonNull } =
		build.graphql
	if (required) {
		const typ = graphQLInputType(build, { type, required: false })
		return new GraphQLNonNull(typ)
	}

	switch (type) {
		case "string":
			return GraphQLString
		case "integer":
			return GraphQLInt
		case "float":
			return GraphQLFloat
		case "boolean":
			return GraphQLBoolean
	}

	throw new Error(`Unsupported type ${type}`)
}

function inputTypeName(type: InsaneType, name: string) {
	return `${type.names.graphql.type}${classify(name)}Input`
}
