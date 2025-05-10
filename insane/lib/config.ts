import type { InsaneType, InsaneTypeDefinition } from "~/lib/schema"
import type { LanguageCode } from "./language"

export type InsaneConfig = {
	/**
	 * The files to look at for graphql queries.
	 *
	 * This accepts globs like (ie, `*.ts`)
	 *
	 * These files will be watched in watch mode.
	 *
	 * @default ["*.ts", "*.tsx"]
	 */
	include?: string[]

	/**
	 * Files to exclude when looking for graphql queries.
	 *
	 * These files will be ignored in watch mode.
	 *
	 * @default ["node_modules"]
	 */
	exclude?: string[]

	/**
	 * The types you will use in your application.
	 */
	types: InsaneTypeDefinition[]

	language?: {
		/**
		 * The default language to use when no language is specified.
		 */
		defaultLanguage?: LanguageCode

		/**
		 * The available languages in the application.
		 */
		languages?: LanguageCode[]
	}
}

export type ValidInsaneConfig = {
	include: string[]
	exclude: string[]
	types: InsaneType[]
	language: {
		defaultLanguage: LanguageCode
		languages: LanguageCode[]
	}
}

export function defineConfig(config: InsaneConfig) {
	const {
		include = ["**/*.ts", "**/*.tsx"],
		exclude = [],
		types = [],
		language: { defaultLanguage = "en", languages = ["en"] } = {},
	} = config

	return {
		include,
		exclude,
		types,
		language: {
			defaultLanguage,
			languages,
		},
	}
}
