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
	connection,
	constant,
	lambda,
} from "grafast"
import { EXPORTABLE } from "graphile-utils"
import type { GraphQLFieldConfigMap, GraphQLOutputType } from "graphql"
import { sql } from "pg-sql2"

import type { InsaneTypeReference } from "~/lib/schema"
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
									(decode, registry) =>
										function (_, { $id }) {
											if (!$id) {
												throw new Error("No id passed")
											}
											const $uid = decode($id!)
											const $document = registry.pgResources.document.get({
												uid: $uid,
											})
											return $document
										},
									[decode, build.input.pgRegistry],
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
						const defn = {
							type: graphQLType(build, field),
							description: field.description,
							deprecationReason: field.deprecated,
							plan: getter(TYPES.jsonb, field.name),
						}
						flds[field.name] = defn

						if (isReferenceType(field.type)) {
							defn.plan = EXPORTABLE(
								(fieldName, refType, constant, pgRegistry, TYPES, sql) =>
									($doc: DocumentStep) => {
										// TODO: handle many step
										const alias = $doc.getClassStep().alias
										return pgRegistry.pgResources.document.get({
											type: constant(refType as string),
											uid: $doc.select(
												sql`(${alias}.data->${sql.literal(fieldName)}->'ref')::bigint`,
												TYPES.bigint,
											),
										})
									},
								[
									field.name,
									field.type.ref,
									constant,
									build.input.pgRegistry,
									TYPES,
									sql,
								],
							)
						} else {
							defn.plan = getter(TYPES.jsonb, field.name)
						}
					}

					return build.extend(fields, flds, `Add fields to ${context.Self.name}`)
				}

				return fields
			},
		},
	},
}

function isReferenceType(
	type: InsaneTypeReference,
): type is { ref: InsaneTypeReference } {
	return typeof type === "object" && "ref" in type
}

type Directives = {
	[name: string]: unknown
}

function graphQLType(
	build: GraphileBuild.Build,
	{ type, required }: { type: InsaneTypeReference; required?: boolean },
): GraphQLOutputType {
	const { GraphQLNonNull, GraphQLString, GraphQLInt, GraphQLBoolean, GraphQLFloat } =
		build.graphql

	if (required) {
		const typ = graphQLType(build, { type, required: false })
		return new GraphQLNonNull(typ)
	}

	if (isReferenceType(type)) {
		return graphQLType(build, { type: type.ref, required })
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

const id = EXPORTABLE(
	(encode) =>
		function ($document: DocumentStep) {
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
