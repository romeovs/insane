import { gql, makeExtendSchemaPlugin } from "graphile-utils"
import { type LanguageCode, languages } from "~/lib/language"
import { version } from "~/lib/version"

type Options = {
	defaultLanguage: LanguageCode
	languages: LanguageCode[]
}

function print(tag: LanguageCode) {
	const info = languages.find((x) => x.code === tag)
	if (!info) {
		throw new Error(`Unsupported language ${tag}`)
	}

	return `
		"""
		${info.name} (${info.code})
		"""
		${info.graphql}
	`
}

export function LanguagesPlugin(options: Options) {
	const { languages } = options

	const langs = Object.values(languages)
	const plugin = makeExtendSchemaPlugin(
		{
			typeDefs: gql`
			"""
			The language used in a document.
			"""
			enum Language {
				${langs.map(print).join("\n")}
			}
		`,
		},
		"LanguagePlugin",
	)

	plugin.version = version
	return plugin
}
