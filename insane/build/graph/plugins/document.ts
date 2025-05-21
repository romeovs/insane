import {
	type PgCodec,
	type PgSelectParsedCursorStep,
	type PgSelectQueryBuilderCallback,
	type PgSelectSingleStep,
	type PgSelectStep,
	TYPES,
	pgPolymorphic,
} from "@dataplan/pg"
import {
	type ConnectionStep,
	type GrafastFieldConfigArgumentMap,
	applyTransforms,
	connection,
	constant,
	context as context_,
	each,
	lambda,
	object,
	sideEffect,
} from "grafast"
import { EXPORTABLE } from "graphile-utils"
import type { GraphQLFieldConfigMap, GraphQLOutputType } from "graphql"
import { sql } from "pg-sql2"

import {
	type InsaneTypeDef,
	isArrayType,
	isReferenceType,
	isUnionType,
} from "~/lib/schema"
import { decode, encode } from "~/lib/uid/plan"
import { version } from "~/lib/version"

type DocumentResource =
	GraphileBuild.Build["input"]["pgRegistry"]["pgResources"]["document"]

export type DocumentStep = PgSelectSingleStep<DocumentResource>
export type DocumentsStep = ConnectionStep<
	PgSelectSingleStep<DocumentResource>,
	PgSelectParsedCursorStep,
	PgSelectStep<DocumentResource>,
	PgSelectSingleStep<DocumentResource>
>

declare global {
	namespace Grafast {
		interface Context {
			items: Set<string>
		}
	}
}

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
				}

				return _
			},
			GraphQLObjectType_fields(fields, build, context) {
				const { GraphQLString, GraphQLInt } = build.graphql

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

				if (context.Self.name === "Query") {
					const { GraphQLID, GraphQLNonNull } = build.graphql

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

						flds[singular] = context.fieldWithHooks({ fieldName: singular }, () => ({
							name: singular,
							description: `Get a single ${singular}.`,
							type: build.getOutputTypeByName(typeName),
							args,
							plan: EXPORTABLE(
								(registry, constant, type, track) => () => {
									const $document = registry.pgResources.document
										.find({
											type: constant(type.name),
										})
										.single()
									track($document)
									return $document
								},
								[build.input.pgRegistry, constant, type, track],
							),
							extensions: {
								directives: {
									oneOf: {},
								},
								insane: {
									type: type.name,
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
									(decode, registry, track) =>
										function (_, { $id }) {
											if (!$id) {
												throw new Error("No id passed")
											}
											const $uid = decode($id!)
											const $document = registry.pgResources.document.get({
												uid: $uid,
											})
											track($document)
											return $document
										},
									[decode, build.input.pgRegistry, track],
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
									(registry, connection, polymorphism, trackList, trackEach) =>
										function () {
											const $documents = registry.pgResources.document.find()
											trackList("*")
											trackEach($documents)
											return connection($documents, { nodePlan: polymorphism })
										},
									[
										build.input.pgRegistry,
										connection,
										polymorphism,
										trackList,
										trackEach,
									],
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
						const defn = {
							type: graphQLType(build, field),
							description: field.description,
							deprecationReason: field.deprecated,
							plan: getter(TYPES.jsonb, field.name),
						}
						flds[field.name] = defn

						if (isReferenceType(field.type)) {
							if (
								field.type.cardinality === "one-to-many" ||
								field.type.cardinality === "many-to-many"
							) {
								// to-many reference
								defn.plan = EXPORTABLE(
									(
										fieldName,
										refType,
										constant,
										pgRegistry,
										TYPES,
										sql,
										track,
										trackEach,
										trackList,
										connection,
									) =>
										($doc: DocumentStep): DocumentsStep => {
											const $docs = pgRegistry.pgResources.document.find({
												type: constant(refType.to),
											})

											const alias = $doc.getClassStep().alias
											const path = `$.${fieldName}[*].ref`
											const $ids = $doc.select(
												sql`jsonb_path_query_array(${alias}.data, ${sql.literal(path)})`,
												TYPES.jsonb,
											)
											$docs.where(
												sql`${$docs.alias}.uid IN (SELECT __id::bigint FROM jsonb_array_elements(${$docs.placeholder($ids, TYPES.jsonb, true)}) as __id)`,
											)

											track($doc)
											trackEach($docs)
											trackList(refType.to)

											return connection($docs)
										},
									[
										field.name,
										field.type,
										constant,
										build.input.pgRegistry,
										TYPES,
										sql,
										track,
										trackEach,
										trackList,
										connection,
									],
								)
							} else {
								// to-one reference
								defn.plan = EXPORTABLE(
									(fieldName, refType, constant, pgRegistry, TYPES, sql, track) =>
										($doc: DocumentStep): DocumentStep => {
											// to-one reference
											const alias = $doc.getClassStep().alias
											const $id = $doc.select(
												sql`(${alias}.data->${sql.literal(fieldName)}->'ref')::bigint`,
												TYPES.bigint,
											)

											const $ref = pgRegistry.pgResources.document.get({
												type: constant(refType.to),
												uid: $id,
											})

											track($doc)
											track($ref)

											return $ref
										},
									[
										field.name,
										field.type,
										constant,
										build.input.pgRegistry,
										TYPES,
										sql,
										track,
									],
								)
							}
						} else {
							// simple getter
							const get = getter(TYPES.jsonb, field.name)
							defn.plan = EXPORTABLE(
								(get, track) => ($doc: DocumentStep) => {
									track($doc)
									return get($doc)
								},
								[get, track],
							)
						}
					}

					return build.extend(fields, flds, `Add fields to ${context.Self.name}`)
				}

				return fields
			},
		},
	},
}

const id = EXPORTABLE(
	(encode) =>
		function ($document: DocumentStep) {
			return encode($document.get("uid"))
		},
	[encode],
)

const track = EXPORTABLE(
	(context, sideEffect, id) => ($document: DocumentStep) => {
		const $items = context().get("items")
		const $type = $document.get("type")
		const $id = id($document)

		sideEffect([$items, $type, $id], ([items, type, id]) => {
			if (type && id) {
				items?.add(`${type}:${id}`)
			}
		})
	},
	[context_, sideEffect, id],
)

const trackEach = EXPORTABLE(
	(context, sideEffect, applyTransforms, each, object, id) =>
		($documents: PgSelectStep) => {
			const $items = context().get("items")
			const $info = applyTransforms(
				each($documents, ($document) =>
					object({
						type: $document.get("type"),
						id: id($document),
					}),
				),
			)

			sideEffect([$items, $info], ([items, info]) => {
				for (const { type, id } of info) {
					items?.add(`${type}:${id}`)
				}
			})
		},
	[context_, sideEffect, applyTransforms, each, object, id],
)

const trackList = EXPORTABLE(
	(sideEffect, context) => (type: string) => {
		const $items = context().get("items")
		sideEffect([$items], ([items]) => {
			if (items) {
				items.add(type)
			}
		})
	},
	[sideEffect, context_],
)

type Directives = {
	[name: string]: unknown
}

function graphQLType(
	build: GraphileBuild.Build,
	{ type, required }: { type: InsaneTypeDef; required?: boolean },
): GraphQLOutputType {
	const {
		GraphQLNonNull,
		GraphQLString,
		GraphQLInt,
		GraphQLBoolean,
		GraphQLFloat,
		GraphQLList,
	} = build.graphql

	if (required) {
		const typ = graphQLType(build, { type, required: false })
		return new GraphQLNonNull(typ)
	}

	if (isReferenceType(type)) {
		if (type.cardinality === "one-to-many" || type.cardinality === "many-to-many") {
			// TODO use actual type name
			const refedType = build.input.config.types.find((t) => t.name === type.to)
			return build.getObjectTypeByName(`${refedType.names.graphql.type}Connection`)
		}
		return graphQLType(build, { type: type.to, required })
	}
	if (isArrayType(type)) {
		return new GraphQLList(graphQLType(build, { type: type.of, required }))
	}
	if (isUnionType(type)) {
		throw new Error("Union types are not supported (yet!)")
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

	const found = build.input.config.types.find((t) => t.name === type)
	if (found) {
		return build.getObjectTypeByName(found.names.graphql.type)
	}

	throw new Error(`Unsupported type ${type}`)
}

function getter(type: PgCodec, ...path: (string | number)[]) {
	if (path.length === 0) {
		throw new Error("path cannot be empty")
	}

	if (path.length === 1) {
		const key = path[0]!.toString()
		return EXPORTABLE(
			(type, sql, key) => ($document: DocumentStep) => {
				const alias = $document.getClassStep().alias
				return $document.select(sql`${alias}.data->${sql.literal(key)}`, type)
			},
			[type, sql, key],
		)
	}

	const pth = path.map((el) => JSON.stringify(el)).join(",")
	return EXPORTABLE(
		(type, sql, pth) => ($document: DocumentStep) => {
			const alias = $document.getClassStep().alias
			return $document.select(sql`${alias}.data #> '{${sql.raw(pth)}}'`, type)
		},
		[type, sql, pth],
	)
}
