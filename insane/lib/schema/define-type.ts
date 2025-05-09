import type { InsaneField } from "./define-field"
import { camelize, capitalize, classify, humanize, pluralize } from "./util"

export type InsaneTypeDefinition = {
	name: string
	title?: string | undefined | null
	deprecated?: boolean | undefined | null
	description?: string | undefined | null

	names?: {
		display?: {
			plural?: string
		}
		graphql?: {
			singular?: string
			plural?: string
			type?: string
		}
	}

	fields: InsaneField[]
}

export type InsaneType = {
	name: string
	deprecated: string | null
	description: string | null

	names: {
		display: {
			singular: string
			plural: string
		}
		graphql: {
			singular: string
			plural: string
			type: string
		}
	}

	fields: InsaneField[]
}

export function defineType(defn: InsaneTypeDefinition) {
	const title = defn.title ?? capitalize(humanize(defn.name))
	return {
		...defn,
		title,
		names: {
			display: {
				plural: defn.names?.display?.plural ?? pluralize(title),
			},
			graphql: {
				singular: defn.names?.graphql?.singular ?? camelize(defn.name),
				plural: defn.names?.graphql?.plural ?? camelize(pluralize(defn.name)),
				type: defn.names?.graphql?.type ?? classify(camelize(defn.name)),
			},
		},
	}
}
