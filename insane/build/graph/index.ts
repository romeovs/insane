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
import type { ValidInsaneConfig } from "~/lib/config"
import { hash } from "~/lib/hash"
import { ConfigPlugin } from "./plugins/config"
import { ContextPlugin } from "./plugins/context"
import { DatabasePlugin } from "./plugins/database"
import { DocumentPlugin } from "./plugins/document"
import { HelpersPlugin } from "./plugins/helpers"
import { InvalidatePlugin } from "./plugins/invalidate"
import { LanguagesPlugin } from "./plugins/language"
import { RemoveEmptyDirectivesPlugin } from "./plugins/remove-empty-directives"
import { ScalarsPlugin } from "./plugins/scalars"
import { StatusPlugin } from "./plugins/status"
import { TotalCountPlugin } from "./plugins/total-count"
import { TypeEnumPlugin } from "./plugins/type"
import { UniquesPlugin } from "./plugins/uniques"
import { UserPlugin } from "./plugins/user"

// Hack until graphile-build exports ConnectionPlugin
const ConnectionPlugin = defaultPreset.plugins!.find(
	(plugin) => plugin.name === "ConnectionPlugin",
)!

export async function build(config: ValidInsaneConfig) {
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
					UniquesPlugin,
					TotalCountPlugin,
					RemoveEmptyDirectivesPlugin,
				],
			},
		],
	})

	const input = await gather(cfg)
	const schema = buildSchema(cfg, input)

	const { code } = await exportSchemaAsString(schema, {
		mode: "graphql-js",
	})

	const sdl = printSchemaWithDirectives(schema, {
		pathToDirectivesInExtensions: ["directives"],
	})

	return {
		hash: await hash(sdl),
		schema,
		code,
		sdl,
	}
}
