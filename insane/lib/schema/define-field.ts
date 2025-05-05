import type { InsaneDataType } from "./registry"

export type InsaneFieldDefinition = {
	name: string
	type: InsaneDataType
	deprecated?: boolean | undefined | null
	description?: string | undefined | null
}

export type InsaneField = {
	name: string
	type: InsaneDataType
	deprecated: boolean
	description: string | null
}

export function defineField(defn: InsaneFieldDefinition): InsaneField {
	return {
		name: defn.name,
		type: defn.type,
		deprecated: Boolean(defn.deprecated),
		description: defn.description ?? null,
	}
}
