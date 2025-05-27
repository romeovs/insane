import { pgPolymorphic } from "@dataplan/pg"
import { connection, lambda } from "grafast"
import { EXPORTABLE } from "graphile-utils"

import type { InsaneType } from "~/lib/schema"
import { decode } from "~/lib/uid/plan"
import { version } from "~/lib/version"
import { track, trackEach, trackList } from "./track"

import { type Directives, type DocumentStep, id } from "./utils"

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
		interface ScopeObjectFieldsField {
			connectionOf?: InsaneType | true
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
				const { GraphQLID } = build.graphql

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
					return build.extend(
						fields,
						{
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

							documents: context.fieldWithHooks(
								{
									fieldName: "documents",
									connectionOf: true,
								},
								() => ({
									name: "documents",
									type: build.getObjectTypeByName("DocumentConnection"),
									description: "Get a list of documents",
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
								}),
							),
						},
						"Add document and documents to Query",
					)
				}

				return fields
			},
		},
	},
}
