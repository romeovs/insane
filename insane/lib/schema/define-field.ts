export type InsaneTypeReference = string | { ref: InsaneTypeReference }

export type InsaneFieldDefinition<Name extends string> = {
	name: Name
	type: InsaneTypeReference
	deprecated?: string | undefined | null
	description?: string | undefined | null
	required?: boolean | undefined
}

export type InsaneField<Name extends string = string> = {
	name: Name
	type: InsaneTypeReference
	deprecated: string | null
	description: string | null
	required: boolean
}

export function defineField<const Name extends string>(
	defn: InsaneFieldDefinition<Name>,
): InsaneField<Name> {
	return {
		name: defn.name,
		type: defn.type,
		deprecated: defn.deprecated ?? null,
		description: defn.description ?? null,
		required: defn.required ?? false,
	}
}
