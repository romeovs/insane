import {
	PgExecutor,
	TYPES,
	enumCodec,
	makePgResourceOptions,
	makeRegistry,
	makeRegistryBuilder,
	recordCodec,
} from "@dataplan/pg"
import { context, object } from "grafast"
import { EXPORTABLE } from "graphile-export"
import { sql } from "pg-sql2"

import type { ValidInsaneConfig } from "~/lib/config"
import { version } from "~/lib/version"

declare global {
	namespace GraphileBuild {
		interface BuildInput {
			config: ValidInsaneConfig
			pgRegistry: ReturnType<typeof mkRegistry>
		}
	}
}

function mkRegistry(input: { config?: ValidInsaneConfig }) {
	if (!input.config) {
		throw new Error("no config in input")
	}

	const polymorphism = {
		mode: "single" as const,
		typeAttributes: ["type"],
		commonAttributes: [],
		types: Object.fromEntries(
			input.config.types.map((type) => [
				type.name,
				{
					name: type.name,
					attributes: [],
				},
			]) ?? [],
		),
	}

	return EXPORTABLE(
		(
			makeRegistry,
			makeRegistryBuilder,
			makePgResourceOptions,
			PgExecutor,
			context,
			object,
			enumCodec,
			sql,
			recordCodec,
			TYPES,
			polymorphism,
		) => {
			const executor = new PgExecutor({
				name: "default",
				// @ts-ignore-error: TODO
				context() {
					const ctx = context()
					return object({
						withPgClient: ctx.get("withPgClient"),
						pgSettings: ctx.get("pgSettings"),
					})
				},
			})

			const roleCodec = enumCodec({
				name: "user_role",
				identifier: sql`user_role`,
				values: ["user", "admin"],
			})

			const userCodec = recordCodec({
				executor,
				name: "user",
				identifier: sql`public."user"`,
				attributes: {
					uid: {
						codec: TYPES.bigint,
						notNull: true,
						hasDefault: false,
					},
					username: {
						codec: TYPES.citext,
						notNull: true,
						hasDefault: false,
					},
				},
			})

			const userResource = makePgResourceOptions({
				executor,
				name: "user",
				codec: userCodec,
				from: sql`"user"`,
				uniques: [
					{ attributes: ["uid"], isPrimary: true },
					{ attributes: ["username"], isPrimary: false },
				],
			})

			const statusCodec = enumCodec({
				name: "doc_status",
				identifier: sql`doc_status`,
				values: ["live", "draft", "archived"],
			})

			const documentCodec = recordCodec({
				executor,
				name: "document",
				identifier: sql`public.document`,
				polymorphism,
				attributes: {
					uid: {
						codec: TYPES.bigint,
						notNull: true,
						hasDefault: false,
					},
					type: {
						codec: TYPES.text,
						notNull: true,
						hasDefault: false,
					},
					version: {
						codec: TYPES.int,
						notNull: true,
						hasDefault: true,
					},
					status: {
						codec: statusCodec,
						notNull: true,
						hasDefault: true,
					},
					created: {
						codec: TYPES.timestamp,
						notNull: true,
						hasDefault: true,
					},
					created_by: {
						codec: TYPES.bigint,
						notNull: true,
						hasDefault: false,
					},
					updated: {
						codec: TYPES.timestamp,
						notNull: true,
						hasDefault: true,
					},
					updated_by: {
						codec: TYPES.bigint,
						notNull: true,
						hasDefault: false,
					},
					language: {
						codec: TYPES.regconfig,
						notNull: true,
						hasDefault: true,
					},
					data: {
						codec: TYPES.jsonb,
						notNull: true,
						hasDefault: true,
					},
				},
			})

			const documentResource = makePgResourceOptions({
				executor,
				name: "document",
				from: sql`document`,
				codec: documentCodec,
				uniques: [{ attributes: ["uid"], isPrimary: true }],
			})

			const builder = makeRegistryBuilder()
				.addCodec(roleCodec)
				.addCodec(userCodec)
				.addResource(userResource)
				.addCodec(statusCodec)
				.addCodec(documentCodec)
				.addResource(documentResource)
				.addRelation(userCodec, "created_documents", documentResource, {
					localAttributes: ["uid"],
					remoteAttributes: ["created_by"],
					isUnique: false,
					isReferencee: true,
				})
				.addRelation(userCodec, "edited_documents", documentResource, {
					localAttributes: ["uid"],
					remoteAttributes: ["updated_by"],
					isUnique: false,
					isReferencee: true,
				})
				.addRelation(documentCodec, "creator", userResource, {
					localAttributes: ["created_by"],
					remoteAttributes: ["uid"],
					isUnique: true,
				})

			return makeRegistry(builder.getRegistryConfig())
		},
		[
			makeRegistry,
			makeRegistryBuilder,
			makePgResourceOptions,
			PgExecutor,
			context,
			object,
			enumCodec,
			sql,
			recordCodec,
			TYPES,
			polymorphism,
		],
	)
}

export function DatabasePlugin(): GraphileConfig.Plugin {
	return {
		name: "ConfigPlugin",
		description: "A plugin that gathers the unsane config and schema",
		version,
		gather: {
			async main(input) {
				input.pgRegistry = mkRegistry(input)
			},
		},
	}
}
