enum Kind {
	simple = "simple",
	reference = "reference",
	array = "array",
	union = "union",
}

type InsaneSimpleType = "string" | "integer" | "float" | "boolean"

type NamedType = string

export type InsaneTypeDef =
	| InsaneSimpleType
	| NamedType
	| InsaneReferenceType
	| InsaneArrayType
	| InsaneUnionType

export type InsaneReferenceType = {
	kind: Kind.reference
	to: NamedType
	inverse: string
	cardinality: "one-to-one" | "one-to-many" | "many-to-many" | "many-to-one"
}

export type InsaneArrayType = {
	kind: Kind.array
	of: InsaneTypeDef
}

export type InsaneUnionType = {
	kind: Kind.union
	of: NamedType[]
}

export function isReferenceType(x: InsaneTypeDef): x is InsaneReferenceType {
	return typeof x === "object" && x.kind === Kind.reference
}

export function isArrayType(x: InsaneTypeDef): x is InsaneArrayType {
	return typeof x === "object" && x.kind === Kind.array
}

export function isUnionType(x: InsaneTypeDef): x is InsaneUnionType {
	return typeof x === "object" && x.kind === Kind.union
}

type InsaneReferenceTypeOptions = {
	inverse: string
	cardinality: "one-to-one" | "one-to-many" | "many-to-many" | "many-to-one"
}

type InsaneArrayTypeOptions = {
	minLength?: number
	maxLength?: number
}

export const t = {
	string: "string",
	float: "float",
	integer: "integer",
	boolean: "boolean",
	reference(
		to: NamedType,
		options: InsaneReferenceTypeOptions,
	): InsaneReferenceType {
		return {
			kind: Kind.reference,
			to,
			...options,
		}
	},
	array(of: InsaneTypeDef, options: InsaneArrayTypeOptions = {}): InsaneArrayType {
		return {
			kind: Kind.array,
			of,
			...options,
		}
	},
	union(...arg: NamedType[]): InsaneUnionType {
		return {
			kind: Kind.union,
			of: arg,
		}
	},
}

export type InsaneFieldDefinition<Name extends string> = {
	name: Name
	type: InsaneTypeDef
	deprecated?: string | undefined | null
	description?: string | undefined | null
	required?: boolean | undefined
}

export type InsaneField<Name extends string = string> = {
	name: Name
	type: InsaneTypeDef
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
