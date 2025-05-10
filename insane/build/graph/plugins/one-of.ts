import { gql, makeExtendSchemaPlugin } from "graphile-utils"
import { version } from "~/lib/version"

export const OneOfPlugin = makeExtendSchemaPlugin(
	{
		typeDefs: gql`
			"""
			Fields with this directive only accept one of the specified arguments.

			@see https://github.com/graphql/graphql-spec/pull/825
			"""
			directive @oneOf on FIELD_DEFINITION | INPUT_OBJECT
		`,
	},
	"OneOfPlugin",
)

OneOfPlugin.version = version
