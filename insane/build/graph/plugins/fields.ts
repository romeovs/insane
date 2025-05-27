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
	type DocumentsStep,
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

						map[field.name] = context.fieldWithHooks(
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
						map[field.name] = context.fieldWithHooks(
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

				for (const otherType of build.input.config.types) {
					for (const field of otherType.fields) {
						if (!isReferenceType(field.type)) {
							continue
						}
						if (field.type.to !== type.name) {
							continue
						}

						if (map[field.type.inverse]) {
							throw new Error(`Field ${field.type.inverse} already exists`)
						}

						// use in -to-one
						const findInverseOne = EXPORTABLE(
							(otherTypeName, otherFieldName, document, sql, TYPES) =>
								($doc: DocumentStep) => {
									const $uid = $doc.get("uid")
									const $referencing = document.find({
										type: otherTypeName,
									})

									$referencing.where(
										sql`${$referencing.placeholder($uid, TYPES.bigint)} = (${$referencing}.data->${sql.literal(otherFieldName)}->'ref')::bigint`,
									)
									return $referencing
								},
							[
								otherType.name,
								field.name,
								build.input.pgRegistry.pgResources.document,
								sql,
								TYPES,
							],
						)

						// use in -to-many
						const findInverseMany = EXPORTABLE(
							(otherFieldName, otherTypeName, document, sql, TYPES) =>
								($doc: DocumentStep) => {
									const path = `$.${otherFieldName}[*].ref`

									const $referencing = document.find({
										type: otherTypeName,
									})

									$referencing.where(
										sql`
											${$referencing.placeholder($doc.get("uid"), TYPES.bigint)} IN (
												SELECT __id::bigint FROM jsonb_array_elements(
													jsonb_path_query_array(
														${$referencing}.data,
														${sql.literal(path)}
													)
											) as __id)`,
									)

									return $referencing
								},
							[
								field.name,
								otherType.name,
								build.input.pgRegistry.pgResources.document,
								sql,
								TYPES,
							],
						)

						// use in one-to-
						const handleOne = EXPORTABLE(
							(track) => ($docs: DocumentsStep) => {
								const $ref = $docs.single()
								track($ref)
								return $ref
							},
							[track],
						)

						// use in many-to-
						const handleMany = EXPORTABLE(
							(trackEach, trackList, connection, otherTypeName) =>
								($docs: DocumentsStep) => {
									trackEach($docs)
									trackList(otherTypeName)
									return connection($docs)
								},
							[trackEach, trackList, connection, otherType.name],
						)

						// this type is referenced by another type
						if (field.type.cardinality === "one-to-one") {
							map[field.type.inverse] = context.fieldWithHooks(
								{
									fieldName: field.type.inverse,
								},
								{
									type: build.getObjectTypeByName(otherType.names.graphql.type),
									description: `Return the ${type.names.graphql.singular} that references this ${type.name} (in the \`${field.name}\` field)`,
									plan: EXPORTABLE(
										(track, findInverseOne, handleOne) => ($doc: DocumentStep) => {
											track($doc)
											const $referencing = findInverseOne($doc)
											return handleOne($referencing)
										},
										[track, findInverseOne, handleOne],
									),
								},
							)
							continue
						}

						if (field.type.cardinality === "many-to-one") {
							map[field.type.inverse] = context.fieldWithHooks(
								{
									fieldName: field.type.inverse,
									connectionOf: otherType,
								},
								{
									type: build.getObjectTypeByName(
										`${otherType.names.graphql.type}Connection`,
									),
									description: `Return the ${type.names.graphql.plural} that reference this ${type.name} (in the \`${field.name}\` field)`,
									plan: EXPORTABLE(
										(findInverseOne, handleMany, track) => ($doc: DocumentStep) => {
											track($doc)
											const $referencing = findInverseOne($doc)
											return handleMany($referencing)
										},
										[findInverseOne, handleMany, track],
									),
								},
							)
							continue
						}

						if (field.type.cardinality === "many-to-many") {
							map[field.type.inverse] = context.fieldWithHooks(
								{
									fieldName: field.type.inverse,
									connectionOf: otherType,
								},
								{
									type: build.getObjectTypeByName(
										`${otherType.names.graphql.type}Connection`,
									),
									description: `Return the ${type.names.graphql.plural} that reference this ${type.name} (in the \`${field.name}\` field)`,
									plan: EXPORTABLE(
										(track, findInverseMany, handleMany) => ($doc: DocumentStep) => {
											track($doc)
											const $refs = findInverseMany($doc)
											return handleMany($refs)
										},
										[track, findInverseMany, handleMany],
									),
								},
							)
							continue
						}

						if (field.type.cardinality === "one-to-many") {
							map[field.type.inverse] = context.fieldWithHooks(
								{
									fieldName: field.type.inverse,
								},
								{
									type: build.getObjectTypeByName(otherType.names.graphql.type),
									description: `Return the ${type.names.graphql.singular} that references this ${type.name} (in the \`${field.name}\` field)`,
									plan: EXPORTABLE(
										(track, findInverseMany, handleOne) => ($doc: DocumentStep) => {
											track($doc)
											const $ref = findInverseMany($doc)
											return handleOne($ref)
										},
										[track, findInverseMany, handleOne],
									),
								},
							)
						}
					}
				}

				return build.extend(fields, map, `Add fields to ${context.Self.name}`)
			},
		},
	},
}
