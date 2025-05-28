import { gql, makeExtendSchemaPlugin } from "graphile-utils"
import { version } from "~/lib/version"

export type InvalidateContext = {
	invalidate?: (() => Promise<void>) | (() => void)
}

export const InvalidatePlugin = makeExtendSchemaPlugin(
	{
		typeDefs: gql`
			extend type Mutation {
				cache: Cache!
			}

			type Cache {
				invalidate: Boolean!
			}
		`,
		resolvers: {
			Mutation: {
				cache() {
					return {}
				},
			},
			Cache: {
				async invalidate(_, __, context) {
					await context?.invalidate?.()
					return true
				},
			},
		},
	},
	"InvalidatePlugin",
)

InvalidatePlugin.version = version
