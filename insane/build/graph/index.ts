import {
	AddNodeInterfaceToSuitableTypesPlugin,
	BuiltinScalarConnectionsPlugin,
	ClientMutationIdDescriptionPlugin,
	CommonTypesPlugin,
	CursorTypePlugin,
	MutationPayloadQueryPlugin,
	MutationPlugin,
	NodeAccessorPlugin,
	NodePlugin,
	PageInfoStartEndCursorPlugin,
	QueryPlugin,
	SubscriptionPlugin,
	TrimEmptyDescriptionsPlugin,
	buildSchema,
	defaultPreset,
	gather,
} from "graphile-build"
import { resolvePreset } from "graphile-config"

import { printSchemaWithDirectives } from "@graphql-tools/utils"
import { exportSchemaAsString } from "graphile-export"
import type { GraphQLSchema } from "graphql"
import type { ValidInsaneConfig } from "~/lib/config"
import { hash } from "~/lib/hash"
import { ConfigPlugin } from "./plugins/config"
import { ConnectionArgsPlugin } from "./plugins/connection"
import { ContextPlugin } from "./plugins/context"
import { DatabasePlugin } from "./plugins/database"
import { DocumentPlugin } from "./plugins/document"
import { FieldsPlugin } from "./plugins/fields"
import { FiltersPlugin } from "./plugins/filters"
import { HelpersPlugin } from "./plugins/helpers"
import { InvalidatePlugin } from "./plugins/invalidate"
import { LanguagesPlugin } from "./plugins/language"
import { QueryTypesPlugin } from "./plugins/query-types"
import { RemoveEmptyDirectivesPlugin } from "./plugins/remove-empty-directives"
import { ScalarsPlugin } from "./plugins/scalars"
import { SortArgsPlugin } from "./plugins/sort"
import { StatusPlugin } from "./plugins/status"
import { TotalCountPlugin } from "./plugins/total-count"
import { TypeEnumPlugin } from "./plugins/type"
import { UniquesPlugin } from "./plugins/uniques"
import { UserPlugin } from "./plugins/user"

import { collect } from "~/build/docs"
import { format } from "~/build/format"

// Hack until graphile-build exports ConnectionPlugin
const ConnectionPlugin = defaultPreset.plugins!.find(
	(plugin) => plugin.name === "ConnectionPlugin",
)!

export type InsaneOutput = {
	hash: string
	schema: GraphQLSchema
	code: string
	sdl: string
	docs: string
}

export async function build(config: ValidInsaneConfig): Promise<InsaneOutput> {
	const cfg = resolvePreset({
		extends: [
			{
				plugins: [
					// Graphile plugins
					QueryPlugin,
					MutationPlugin,
					SubscriptionPlugin,
					ClientMutationIdDescriptionPlugin,
					ConnectionPlugin,
					MutationPayloadQueryPlugin,
					CursorTypePlugin,
					CommonTypesPlugin,
					NodePlugin,
					BuiltinScalarConnectionsPlugin,
					PageInfoStartEndCursorPlugin,
					TrimEmptyDescriptionsPlugin,
					AddNodeInterfaceToSuitableTypesPlugin,
					NodeAccessorPlugin,

					// Custom plugins
					ConfigPlugin(config),
					ScalarsPlugin,
					HelpersPlugin,
					LanguagesPlugin(config.language),
					StatusPlugin,
					ContextPlugin,
					DatabasePlugin(),
					InvalidatePlugin,
					UserPlugin,
					TypeEnumPlugin,
					DocumentPlugin,
					QueryTypesPlugin,
					ConnectionArgsPlugin,
					FieldsPlugin,
					UniquesPlugin,
					SortArgsPlugin,
					FiltersPlugin,
					TotalCountPlugin,
					RemoveEmptyDirectivesPlugin,
				],
			},
		],
	})

	const input = await gather(cfg)
	const schema = buildSchema(cfg, input)

	const [sdl, code, docs] = await Promise.all([
		printSchema(schema),
		printCode(schema),
		printDocs(schema),
	])

	return {
		hash: await hash(sdl),
		schema,
		code,
		sdl,
		docs,
	}
}

async function printSchema(schema: GraphQLSchema) {
	const sdl = printSchemaWithDirectives(schema, {
		pathToDirectivesInExtensions: ["directives"],
	})
	return format(sdl, "graphql")
}

async function printCode(schema: GraphQLSchema) {
	const { code } = await exportSchemaAsString(schema, {
		mode: "graphql-js",
	})

	const clean = code
		// inline sql literal where possible
		.replaceAll(/\$\{sql\.literal\("([^"]+)"\)\}/g, "'$1'")
		// remove useless prototypes
		.replaceAll(/__proto__: null,?/g, "")

	return format(clean, "ts")
}

async function printDocs(schema: GraphQLSchema) {
	const docs = await collect(schema)
	return `export const docs = ${JSON.stringify(docs)}`
}
