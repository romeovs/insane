import tsplugin from "ts-graphql-plugin"
import type ts from "typescript/lib/tsserverlibrary"

const factory: ts.server.PluginModuleFactory = function (...args) {
	const plugin = (tsplugin as ts.server.PluginModuleFactory)(...args)

	return {
		...plugin,
		create(info: ts.server.PluginCreateInfo) {
			return plugin.create({
				...info,
				config: {
					...info.config,
					tag: {
						name: "graphql",
						allowNotTaggedTemplate: false,
						allowTaggedTemplateExpression: true,
						allowFunctionCallExpression: true,
					},
					schema: ".insane/generated/schema.graphql",
					enabledGlobalFragments: true,
				},
			})
		},
	}
}

// @ts-expect-error
export = factory
