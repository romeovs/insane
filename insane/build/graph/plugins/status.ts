import { gql, makeExtendSchemaPlugin } from "graphile-utils"
import { version } from "~/lib/version"

export const StatusPlugin = makeExtendSchemaPlugin(
	{
		typeDefs: gql`
			"""
			The publishing status of a document.
			"""
			enum Status {
				"""
				The document is published and should be shown on the site.
				"""
				LIVE

				"""
				The document is archived and should not be shown on the site,
				but can be edited in the content manager.
				"""
				DRAFT

				"""
				The document is archived and should not be shown on the site
				or in the content manager.
				"""
				ARCHIVED
			}
		`,
	},
	"LanguagePlugin",
)

StatusPlugin.version = version
