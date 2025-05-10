import { gql, makeExtendSchemaPlugin } from "graphile-utils"

import { version } from "~/lib/version"

export const TypeEnumPlugin = makeExtendSchemaPlugin(function (build) {
	// TODO: use graphql type name
	// const names = build.input.config.types.map((type) => type.graphql?.single)
	const names = build.input.config.types.map((type) => type.name)
	return {
		typeDefs: gql`
			enum Type {
				${names.join("\n")}
			}
		`,
	}
}, "TypeEnumPlugin")

TypeEnumPlugin.version = version
