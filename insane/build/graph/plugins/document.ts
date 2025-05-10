import {
	type PgCodec,
	type PgSelectSingleStep,
	TYPES,
	pgPolymorphic,
} from "@dataplan/pg"
import { connection, lambda } from "grafast"
import { EXPORTABLE } from "graphile-utils"
import type { GraphQLFieldConfigMap, GraphQLOutputType } from "graphql"
import { sql } from "pg-sql2"

import { decode, encode } from "~/lib/uid/plan"
import { version } from "~/lib/version"

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
								extensions: {
									grafast: {
										plan: EXPORTABLE(
											(lambda) => ($document: PgSelectSingleStep) =>
												lambda(
													$document.get("status"),
													(input: string) => input.toUpperCase(),
													true,
												),
											[lambda],
										),
									},
								},
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
								extensions: {
									grafast: {
										plan: id,
									},
								},
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
									extensions: {
										grafast: {
											plan: id,
										},
									},
								},
								metadata: {
									description: `The metadata for the ${type.names.graphql.singular} document.`,
									type: build.getObjectTypeByName("DocumentMetadata"),
									extensions: {
										grafast: {
											plan: EXPORTABLE(() => ($document) => $document, []),
										},
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
				}

				return _
			},
			GraphQLObjectType_fields(fields, build, context) {
				if (context.Self.name === "Query") {
					const { GraphQLID, GraphQLNonNull } = build.graphql

					const matchers = Object.fromEntries(
						build.input.config.types.map((type) => [
							type.names.graphql.type,
							{
								match: EXPORTABLE(
									(name) => (specifier: string) => specifier === name,
									[type.name],
								),
								plan: EXPORTABLE(
									() => (_: unknown, $document: PgSelectSingleStep) => $document,
									[],
								),
							},
						]),
					)

					const polymorphism = EXPORTABLE(
						(pgPolymorphic, matchers) => ($document: PgSelectSingleStep) =>
							pgPolymorphic($document, $document.get("type"), matchers),
						[pgPolymorphic, matchers],
					)

					const flds: GraphQLFieldConfigMap<unknown, unknown> = {}
					for (const type of build.input.config.types) {
						const typeName = type.names.graphql.type
						if (!typeName) {
							throw new Error(`No type name set for type ${type.name}`)
						}

						const singular = type.names.graphql.singular
						if (!singular) {
							throw new Error(`No singular name set for type ${type.name}`)
						}

						const plural = type.names.graphql.plural
						if (!plural) {
							throw new Error(`No plural name set for type ${type.name}`)
						}

						flds[singular] = context.fieldWithHooks({ fieldName: singular }, () => ({
							name: singular,
							type: build.getOutputTypeByName(typeName),
							args: {
								id: {
									type: GraphQLID,
								},
								// TODO: by uniques
								// TODO: by filters
							},
							description: `Get a single ${singular}.`,
							extensions: {
								directives: {
									oneOf: {},
								},
								grafast: {
									plan: EXPORTABLE(
										(pgRegistry, decode) =>
											(_, { $id }) => {
												if (!$id) {
													throw new Error("Not enough arguments")
												}

												const $uid = decode($id)
												return pgRegistry.pgResources.document.get({ uid: $uid })
											},
										[build.input.pgRegistry, decode],
									),
								},
							},
						}))

						const connectionType = build.getObjectTypeByName(`${typeName}Connection`)

						flds[plural] = context.fieldWithHooks({ fieldName: plural }, () => ({
							name: plural,
							description: `Get ${plural} based on the provided filters.`,
							type: new GraphQLNonNull(connectionType),
							extensions: {
								grafast: {
									plan: EXPORTABLE(
										(type, pgRegistry, connection) => (_) => {
											return connection(
												pgRegistry.pgResources.document.find({ type }),
											)
										},
										[type.name, build.input.pgRegistry, connection],
									),
								},
							},
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
								extensions: {
									grafast: {
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
									},
								},
							})),
							documents: context.fieldWithHooks({ fieldName: "documents" }, () => ({
								name: "documents",
								type: build.getObjectTypeByName("DocumentConnection"),
								description: "Get a list of documents",
								args: {
									// TODO: add filters
								},
								extensions: {
									grafast: {
										plan: EXPORTABLE(
											(registry, connection, polymorphism) =>
												function () {
													// TODO: use filters from args
													// TODO: use pagination and edges/node

													const $documents = registry.pgResources.document.find()
													return connection($documents, polymorphism)
												},
											[build.input.pgRegistry, connection, polymorphism],
										),
									},
								},
							})),
						},
						"Add document and documents to Query",
					)
				}

				// @ts-expect-error
				const typename = context.Self.extensions.insane?.type?.name

				if (typename) {
					const flds: GraphQLFieldConfigMap<unknown, unknown> = {}
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
							extensions: {
								grafast: {
									plan: getter(TYPES.jsonb, field.name),
								},
							},
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
		case "int":
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
