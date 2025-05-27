import {
	type PgSelectQueryBuilderCallback,
	TYPES,
	pgPolymorphic,
} from "@dataplan/pg"
import {
	type GrafastFieldConfigArgumentMap,
	connection,
	constant,
	lambda,
} from "grafast"
import { EXPORTABLE } from "graphile-utils"
import type { GraphQLFieldConfigMap } from "graphql"
import { sql } from "pg-sql2"

import { isReferenceType } from "~/lib/schema"
import { decode } from "~/lib/uid/plan"
import { version } from "~/lib/version"

import type { InsaneType } from "~/dist/config"
import { track, trackEach, trackList } from "./track"
import {
	type Directives,
	type DocumentStep,
	type DocumentsConnectionStep,
	getter,
	graphQLType,
	id,
} from "./utils"

declare global {
	namespace GraphileBuild {
		interface ScopeObject {
			insane?: {
				type: InsaneType
			}
		}
		interface ScopeInputObject {
			insane?: {
				type: InsaneType
			}
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
						{
							insane: {
								type,
							},
						},
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
							plan(_: unknown, $document: DocumentStep) {
								return $document
							},
						},
					]),
				)

				const polymorphism = EXPORTABLE(
					(pgPolymorphic, matchers) => ($document: DocumentStep) => {
						return pgPolymorphic($document, $document.get("type"), matchers)
					},
					[pgPolymorphic, matchers],
				)

				if (context.scope.isRootQuery) {
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
								},
							}),
						)

						flds[plural] = context.fieldWithHooks(
							{
								fieldName: plural,
								insane: {
									type,
								},
							},
							// @ts-expect-error: listStep is missing on connection?
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
								plan: EXPORTABLE(
									(document, connection, polymorphism, trackList, trackEach) =>
										function () {
											const $documents = document.find()
											trackList("*")
											trackEach($documents)
											return connection($documents, { nodePlan: polymorphism })
										},
									[
										build.input.pgRegistry.pgResources.document,
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

				const type = context.scope.insane?.type
				if (type) {
					const flds: GraphileBuild.GrafastFieldConfigMap<DocumentStep> = {}

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
										document,
										TYPES,
										sql,
										track,
										trackEach,
										trackList,
										connection,
									) =>
										($doc: DocumentStep): DocumentsConnectionStep => {
											const $docs = document.find({
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
										build.input.pgRegistry.pgResources.document,
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
									(fieldName, refType, constant, document, TYPES, sql, track) =>
										($doc: DocumentStep): DocumentStep => {
											// to-one reference
											const alias = $doc.getClassStep().alias
											const $id = $doc.select(
												sql`(${alias}.data->${sql.literal(fieldName)}->'ref')::bigint`,
												TYPES.bigint,
											)

											const $ref = document.get({
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
										build.input.pgRegistry.pgResources.document,
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
