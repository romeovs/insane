import { PgClassFilter, type PgCondition } from "@dataplan/pg"
import type { FieldArg } from "grafast"
import { EXPORTABLE } from "graphile-build"
import { sql } from "pg-sql2"

import { version } from "~/lib/version"
import type { DocumentsConnectionStep } from "./utils"

export const FiltersPlugin: GraphileConfig.Plugin = {
	name: "FiltersPlugin",
	description: "Adds arguments for filtering lists of types",
	version,
	schema: {
		hooks: {
			init(_, build) {
				const { GraphQLString, GraphQLBoolean } = build.graphql

				// TODO: int filter
				// TODO: float filter
				// TODO: date filter
				// TODO: boolean filter
				// TODO: composite filter?
				// TODO: not filter

				build.registerInputObjectType(
					"StringFilter",
					{},
					() => ({
						description: "Filter for strings",
						fields: {
							eq: {
								type: GraphQLString,
								description: "Check if the string is equal to the provided value",
								apply: EXPORTABLE(
									(sql) => ($step: PgCondition, arg) => {
										$step.where(sql`${$step.alias} = ${sql.value(arg)}`)
									},
									[sql],
								),
							},
							neq: {
								type: GraphQLString,
								description: "Check if the string is equal to the provided value",
								apply: EXPORTABLE(
									(sql) => ($step: PgCondition, arg) => {
										$step.where(sql`${$step.alias} != ${sql.value(arg)}`)
									},
									[sql],
								),
							},
							startsWith: {
								type: GraphQLString,
								description: "Check if the string is equal to the provided value",
								apply: EXPORTABLE(
									(sql) => ($step: PgCondition, arg) => {
										$step.where(sql`starts_with(${$step.alias}, ${sql.value(arg)})`)
									},
									[sql],
								),
							},
							endsWith: {
								type: GraphQLString,
								description: "Check if the string is equal to the provided value",
								apply: EXPORTABLE(
									(sql) => ($step: PgCondition, arg) => {
										$step.where(sql`ends_with(${$step.alias}, ${sql.value(arg)})`)
									},
									[sql],
								),
							},
							empty: {
								type: GraphQLBoolean,
								description: "Check if the string has no value (is empty or unset)",
								apply: EXPORTABLE(
									(sql) => ($step: PgCondition, arg) => {
										if (arg === true) {
											$step.where(sql`${$step.alias} is null OR ${$step.alias} = ''`)
										} else {
											$step.where(
												sql`${$step.alias} is not null AND ${$step.alias} != ''`,
											)
										}
									},
									[sql],
								),
							},
							caseSensitive: {
								// TODO: actually apply this?
								type: GraphQLBoolean,
								description: "Set to false to make the filter case insensitive",
								defaultValue: true,
							},
						},
					}),
					"Add StringFilter input type",
				)

				for (const type of build.input.config.types) {
					build.registerInputObjectType(
						`${type.names.graphql.type}Filter`,
						{
							insane: {
								type,
							},
						},
						() => ({
							description: `Filter for ${type.names.display.plural}`,
							fields: () =>
								Object.fromEntries(
									// @ts-expect-error
									type.fields
										.map((field) => {
											if (field.type === "string") {
												return [
													field.name,
													{
														type: build.getInputTypeByName("StringFilter"),
														apply: EXPORTABLE(
															(PgClassFilter, sql, fieldName) =>
																($step: PgCondition, arg: FieldArg) => {
																	if (arg === null) {
																		return
																	}

																	// Each filter property is an AND condition
																	return new PgClassFilter(
																		$step.andPlan(),
																		sql`${$step.alias}.data->>${sql.literal(fieldName)}`,
																	)
																},
															[PgClassFilter, sql, field.name],
														),
													},
												]
											}
										})
										.filter(Boolean),
								),
						}),
						"Add StringFilter input type",
					)
				}

				return _
			},
			GraphQLObjectType_fields_field_args(args, build, context) {
				const type = context.scope.connectionOf
				if (!type || type === true) {
					return args
				}
				const { GraphQLList } = build.graphql

				return build.extend(
					args,
					{
						where: {
							type: new GraphQLList(
								build.getInputTypeByName(`${type.names.graphql.type}Filter`),
							),
							applyPlan: (
								_,
								$connection: DocumentsConnectionStep,
								arg: FieldArg,
							) => {
								const $select = $connection.getSubplan()
								// each array element is an OR condition
								arg.apply($select, ($step) => $step.whereBuilder().orPlan())
							},
						},
					},
					`Add filters for ${context.scope.fieldName}`,
				)
			},
		},
	},
}
