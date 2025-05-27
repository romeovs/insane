import { connection, constant } from "grafast"
import { EXPORTABLE } from "graphile-utils"
import { version } from "~/lib/version"
import { track, trackEach, trackList } from "./track"

import { TYPES } from "@dataplan/pg"
import { sql } from "pg-sql2"
import { isReferenceType } from "~/config"
import {
	type DocumentStep,
	type DocumentsConnectionStep,
	getter,
	graphQLType,
} from "./utils"

export const FieldsPlugin: GraphileConfig.Plugin = {
	name: "FieldsPlugin",
	description: "Adds user-defined fields to their respective types",
	version,
	schema: {
		hooks: {
			GraphQLObjectType_fields(fields, build, context) {
				const type = context.scope.insane?.type

				if (!type) {
					return fields
				}

				const map: GraphileBuild.GrafastFieldConfigMap<DocumentStep> = {}

				for (const field of type.fields) {
					const base = {
						type: graphQLType(build, field),
						description: field.description,
						deprecationReason: field.deprecated,
					}

					if (
						isReferenceType(field.type) &&
						(field.type.cardinality === "one-to-many" ||
							field.type.cardinality === "many-to-many")
					) {
						// to-many reference

						const to = field.type.to
						const connectionOf = build.input.config.types.find(
							(type) => to === type.name,
						)
						if (!connectionOf) {
							throw new Error(`No type found for ${to}`)
						}

						fields[field.name] = context.fieldWithHooks(
							{
								fieldName: field.name,
								connectionOf,
							},
							{
								...base,
								plan: EXPORTABLE(
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
								),
							},
						)
						continue
					}

					if (isReferenceType(field.type)) {
						// to-one reference
						fields[field.name] = context.fieldWithHooks(
							{
								fieldName: field.name,
							},
							{
								...base,
								plan: EXPORTABLE(
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
								),
							},
						)
						continue
					}

					// simple getter
					const get = getter(TYPES.jsonb, field.name)
					map[field.name] = context.fieldWithHooks(
						{ fieldName: field.name },
						{
							...base,
							plan: EXPORTABLE(
								(get, track) => ($doc: DocumentStep) => {
									track($doc)
									return get($doc)
								},
								[get, track],
							),
						},
					)
				}

				return build.extend(fields, map, `Add fields to ${context.Self.name}`)
			},
		},
	},
}
