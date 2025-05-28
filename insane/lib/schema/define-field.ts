declare global {
	namespace Insane.Schema {
		export type FieldDefinition<Name extends string> = {
			name: Name
			type: Type
			deprecated?: string | undefined | null
			description?: string | undefined | null
			required?: boolean | undefined
		}

		export type Field<Name extends string = string> = {
			name: Name
			type: Type
			deprecated: string | null
			description: string | null
			required: boolean
		}
	}
}

import schema = Insane.Schema

export function defineField<const Name extends string>(
	defn: schema.FieldDefinition<Name>,
): schema.Field<Name> {
	return {
		name: defn.name,
		type: defn.type,
		deprecated: defn.deprecated ?? null,
		description: defn.description ?? null,
		required: defn.required ?? false,
	}
}
