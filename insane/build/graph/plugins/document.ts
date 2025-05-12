import {
	type PgCodec,
	type PgSelectQueryBuilderCallback,
	type PgSelectSingleStep,
	type PgSelectStep,
	TYPES,
	pgPolymorphic,
} from "@dataplan/pg"
import {
	type FieldArg,
	type GrafastFieldConfigArgumentMap,
	bakedInput,
	connection,
	constant,
	lambda,
} from "grafast"
import { EXPORTABLE } from "graphile-utils"
import type {
	GraphQLFieldConfigMap,
	GraphQLInputType,
	GraphQLOutputType,
} from "graphql"
import { sql } from "pg-sql2"

import { decode, encode } from "~/lib/uid/plan"
import { version } from "~/lib/version"

type DocumentResource =
	GraphileBuild.Build["input"]["pgRegistry"]["pgResources"]["document"]

type DocumentStep = PgSelectSingleStep<DocumentResource>
type DocumentsStep = PgSelectStep<DocumentResource>

export const DocumentPlugin: GraphileConfig.Plugin = {
	name: "DocumentPlugin",
	description: "Adds Document type",
	version,
	schema: {
		hooks: {
			init(_, build) {
				const { GraphQLNonNull, GraphQLID, GraphQLInt } = build.graphql

				build.registerObjectType(
					"DocumentMetadata",
					{},
					() => ({
						fields: () => ({
							type: {
								description: "The type of the document.",
								type: new GraphQLNonNull(build.getEnumTypeByName("Type")),
							},
							status: {
								description: "The publishing status of the document.",
								type: new GraphQLNonNull(build.getEnumTypeByName("Status")),
								plan: EXPORTABLE(
									(lambda) => ($document: DocumentStep) =>
										lambda(
											$document.get("status"),
											(input: string) => input.toUpperCase(),
											true,
										),
									[lambda],
								),
							},
							version: {
								description: "The current version of the document.",
								type: new GraphQLNonNull(GraphQLInt),
							},
							created: {
								description: "The datetime at which the document was created.",
								type: new GraphQLNonNull(build.getScalarTypeByName("DateTime")),
							},
							updated: {
								description:
									"The datetime at which the document was last updated. If this is the first version, it will be equal to `created`.",
								type: new GraphQLNonNull(build.getScalarTypeByName("DateTime")),
							},
							language: {
								description: "The language of the document.",
								type: new GraphQLNonNull(build.getEnumTypeByName("Language")),
							},
						}),
					}),
					"Metadata for documents",
				)

				build.registerInterfaceType(
					"Document",
					{},
					() => ({
						interfaces: () => [build.getInterfaceTypeByName("Node")],
						fields: () => ({
							id: {
								description: "The globally unique identifier of the document.",
								type: new GraphQLNonNull(GraphQLID),
								plan: id,
							},
							metadata: {
								description: "The metadata for the document.",
								type: build.getObjectTypeByName("DocumentMetadata"),
							},
						}),
					}),
					"Document interface",
				)

				build.registerCursorConnection({ typeName: "Document", nonNullNode: true })

				for (const type of build.input.config.types) {
					const directives: Directives = {}
					if (type.deprecated) {
						directives.deprecated = {
							reason: type.deprecated,
						}
					}

					build.registerObjectType(
						type.names.graphql.type,
						{},
						() => ({
							interfaces: () => [
								build.getInterfaceTypeByName("Node"),
								build.getInterfaceTypeByName("Document"),
							],
							description: type.description,
							fields: () => ({
								id: {
									description: `The globally unique identifier of the ${type.names.graphql.singular}.`,
									type: new GraphQLNonNull(GraphQLID),
									plan: id,
								},
								metadata: {
									description: `The metadata for the ${type.names.graphql.singular} document.`,
									type: build.getObjectTypeByName("DocumentMetadata"),
									plan($document) {
										return $document
									},
								},
							}),
							extensions: {
								directives,
								insane: {
									type: {
										name: type.name,
										graphql: type.names.graphql.type,
									},
								},
							},
						}),
						`${type.names.graphql.type} for Document`,
					)

					build.registerCursorConnection({
						typeName: type.names.graphql.type,
						nonNullNode: true,
					})

					for (const name in type.uniques) {
						const unique = type.uniques[name]!

						const fields = {}
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
								`${type.names.graphql.type}${name}Input`,
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
			GraphQLObjectType_fields(fields, build, context) {
				const { GraphQLString, GraphQLInt } = build.graphql

				if (context.Self.name === "Query") {
					const { GraphQLID, GraphQLNonNull } = build.graphql

					const matchers = Object.fromEntries(
						build.input.config.types.map((type) => [
							type.names.graphql.type,
							{
								match: EXPORTABLE(
									(name) => (specifier: string) => {
										return specifier === name
									},
									[type.name],
								),
								plan: EXPORTABLE(
									() => (_: unknown, $document: DocumentStep) => $document,
									[],
								),
							},
						]),
					)

					const polymorphism = EXPORTABLE(
						(pgPolymorphic, matchers) => ($document: DocumentStep) =>
							pgPolymorphic($document, $document.get("type"), matchers),
						[pgPolymorphic, matchers],
					)

					const flds: GraphQLFieldConfigMap<unknown, unknown> = {}
					for (const type of build.input.config.types) {
						const { type: typeName, singular, plural } = type.names.graphql

						const args: GrafastFieldConfigArgumentMap = {
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
						}

						// Add uniques
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

								args[name] = {
									type: fieldType,
									applyPlan: EXPORTABLE(
										(fieldName, sql, lambda) =>
											(_: unknown, $document: DocumentStep, arg: FieldArg) => {
												const $condition = lambda(
													arg.getRaw(),
													(value): PgSelectQueryBuilderCallback =>
														function (qb) {
															if (value === undefined) {
																return
															}
															// TODO: do not cast to text
															qb.where(
																sql`${qb.alias}.data->${sql.literal(fieldName)} = jsonb(${sql.value(JSON.stringify(value))}::text)`,
															)
														},
												)
												$document.getClassStep().apply($condition)
											},
										[fieldName, sql, lambda],
									),
								}
							} else {
								const type = build.getInputTypeByName(`${typeName}${name}Input`)
								args[name] = {
									type,
									applyPlan: EXPORTABLE(
										(fieldNames, sql, lambda, bakedInput) =>
											(_: unknown, $document: DocumentStep, arg: FieldArg) => {
												const value = arg.getRaw()
												const inputs = fieldNames.map((fieldName) =>
													bakedInput(arg.typeAt(fieldName), arg.getRaw(fieldName)),
												)

												const $conditions = lambda(
													[value, ...inputs],
													([arg, ...values]): PgSelectQueryBuilderCallback =>
														function (qb) {
															if (arg === undefined) {
																return
															}
															values.forEach((value, idx) => {
																const fieldName = fieldNames[idx]!
																if (value === undefined) {
																	qb.where(
																		sql`${qb.alias}.data->${sql.literal(fieldName)} is null`,
																	)
																} else {
																	qb.where(
																		sql`${qb.alias}.data->${sql.literal(fieldName)} = jsonb(${sql.value(JSON.stringify(value))}::text)`,
																	)
																}
															})
														},
												)
												$document.getClassStep().apply($conditions)
											},
										[unique, sql, lambda, bakedInput],
									),
								}
							}
						}

						flds[singular] = context.fieldWithHooks({ fieldName: singular }, () => ({
							name: singular,
							description: `Get a single ${singular}.`,
							type: build.getOutputTypeByName(typeName),
							args,
							plan: EXPORTABLE(
								(registry, constant, type) => () => {
									return registry.pgResources.document
										.find({
											type: constant(type.name),
										})
										.single()
								},
								[build.input.pgRegistry, constant, type],
							),
							extensions: {
								directives: {
									oneOf: {},
								},
							},
						}))

						const connectionType = build.getObjectTypeByName(`${typeName}Connection`)

						// TODO: by filters

						flds[plural] = context.fieldWithHooks({ fieldName: plural }, () => ({
							name: plural,
							description: `Get ${plural} based on the provided filters.`,
							type: new GraphQLNonNull(connectionType),
							plan: EXPORTABLE(
								(type, pgRegistry, connection) => () => {
									return connection(pgRegistry.pgResources.document.find({ type }))
								},
								[type.name, build.input.pgRegistry, connection],
							),
						}))
					}

					return build.extend(
						fields,
						{
							...flds,
							document: context.fieldWithHooks({ fieldName: "document" }, () => ({
								name: "document",
								type: build.getOutputTypeByName("Document"),
								description: "Get a document by its ID",
								args: {
									id: {
										type: GraphQLID,
										description: "The ID of the document",
									},
								},
								plan: EXPORTABLE(
									(decode, registry, polymorphism) =>
										function (_, { $id }) {
											if (!$id) {
												throw new Error("No id passed")
											}
											const $uid = decode($id!)
											const $document = registry.pgResources.document.get({
												uid: $uid,
											})
											return polymorphism($document)
										},
									[decode, build.input.pgRegistry, polymorphism],
								),
							})),
							documents: context.fieldWithHooks({ fieldName: "documents" }, () => ({
								name: "documents",
								type: build.getObjectTypeByName("DocumentConnection"),
								description: "Get a list of documents",
								args: {
									// TODO: add filters
									first: {
										type: GraphQLInt,
										applyPlan(_, $documents: DocumentsStep, arg) {
											$documents.setFirst(arg.getRaw())
										},
									},
									last: {
										type: GraphQLInt,
										applyPlan(_, $documents: DocumentsStep, arg) {
											$documents.setLast(arg.getRaw())
										},
									},
									after: {
										type: GraphQLString,
										applyPlan(_, $documents: DocumentsStep, arg) {
											$documents.setAfter(arg.getRaw())
										},
									},
									before: {
										type: GraphQLString,
										applyPlan(_, $documents: DocumentsStep, arg) {
											$documents.setBefore(arg.getRaw())
										},
									},
								},
								plan: EXPORTABLE(
									(registry, connection, polymorphism) =>
										function () {
											// TODO: use filters from args
											// TODO: use pagination and edges/node

											const $documents = registry.pgResources.document.find()
											return connection($documents, { nodePlan: polymorphism })
										},
									[build.input.pgRegistry, connection, polymorphism],
								),
							})),
						},
						"Add document and documents to Query",
					)
				}

				// @ts-expect-error
				const typename = context.Self.extensions.insane?.type?.name

				if (typename) {
					const flds: GraphileBuild.GrafastFieldConfigMap<DocumentStep> = {}
					const type = build.input.config.types.find(
						(type) => type.name === typename,
					)
					if (!type) {
						throw new Error(`no such type ${typename}`)
					}

					for (const field of type.fields) {
						flds[field.name] = {
							type: graphQLType(build, field),
							description: field.description,
							deprecationReason: field.deprecated,
							plan: getter(TYPES.jsonb, field.name),
						}
					}

					return build.extend(fields, flds, `Add fields to ${context.Self.name}`)
				}

				return fields
			},
		},
	},
}

type Directives = {
	[name: string]: unknown
}

function graphQLType(
	build: GraphileBuild.Build,
	{ type, required }: { type: string; required?: boolean },
): GraphQLOutputType {
	const { GraphQLNonNull } = build.graphql
	if (required) {
		const typ = graphQLType(build, { type, required: false })
		return new GraphQLNonNull(typ)
	}

	const { GraphQLString, GraphQLInt, GraphQLBoolean, GraphQLFloat } = build.graphql
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

	const found = build.input.config.types.find((t) => t.name === type)
	if (found) {
		return build.getObjectTypeByName(found.names.graphql.type)
	}

	throw new Error(`Unsupported type ${type}`)
}

function graphQLInputType(
	build: GraphileBuild.Build,
	{ type, required }: { type: string; required?: boolean },
): GraphQLInputType {
	const { GraphQLNonNull } = build.graphql
	if (required) {
		const typ = graphQLInputType(build, { type, required: false })
		return new GraphQLNonNull(typ)
	}

	const { GraphQLString, GraphQLInt, GraphQLBoolean, GraphQLFloat } = build.graphql
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

const id = EXPORTABLE(
	(encode) =>
		function ($document: PgSelectSingleStep) {
			return encode($document.get("uid"))
		},
	[encode],
)

function getter(type: PgCodec, ...path: (string | number)[]) {
	if (path.length === 0) {
		throw new Error("path cannot be empty")
	}

	if (path.length === 1) {
		const key = path[0]!.toString()
		return EXPORTABLE(
			(type, sql, key) =>
				function ($document: PgSelectSingleStep) {
					return $document.select(sql`data->${sql.literal(key)}`, type)
				},
			[type, sql, key],
		)
	}

	const pth = path.map((el) => JSON.stringify(el)).join(",")
	return EXPORTABLE(
		(type, sql, pth) =>
			function ($document: PgSelectSingleStep) {
				return $document.select(sql`data #> '{${sql.raw(pth)}}'`, type)
			},
		[type, sql, pth],
	)
}
