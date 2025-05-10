import type { InsaneDataType } from "./registry"

export type InsaneFieldDefinition = {
	name: string
	type: InsaneDataType
	deprecated?: string | undefined | null
	description?: string | undefined | null
	required?: boolean | undefined
}

export type InsaneField = {
	name: string
	type: InsaneDataType
	deprecated: string | null
	description: string | null
	required: boolean
}

export function defineField(defn: InsaneFieldDefinition): InsaneField {
	return {
		name: defn.name,
		type: defn.type,
		deprecated: defn.deprecated ?? null,
		description: defn.description ?? null,
		required: defn.required ?? false,
	}
}
