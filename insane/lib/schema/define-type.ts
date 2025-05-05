import type { InsaneField } from "./define-field"

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
	deprecated: boolean
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
	return defn
}
