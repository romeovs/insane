import { printSchemaWithDirectives } from "@graphql-tools/utils"
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
import type { GraphQLSchema } from "graphql"
import { format } from "~/build/format"
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
import { OperationInfoPlugin } from "./plugins/info"
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

// Hack until graphile-build exports ConnectionPlugin
const ConnectionPlugin = defaultPreset.plugins!.find(
	(plugin) => plugin.name === "ConnectionPlugin",
)!

export type InsaneOutput = {
	hash: string
	schema: GraphQLSchema
	sdl: string
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
					OperationInfoPlugin,
				],
			},
		],
	})

	const input = await gather(cfg)
	const schema = buildSchema(cfg, input)

	const sdl = await format(
		printSchemaWithDirectives(schema, {
			pathToDirectivesInExtensions: ["directives"],
		}),
		"graphql",
	)

	return {
		hash: await hash(sdl),
		schema,
		sdl,
	}
}
