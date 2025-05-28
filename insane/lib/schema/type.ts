declare global {
	namespace Insane.Schema {
		export type Type =
			| CustomTypeName
			| SimpleType
			| ReferenceType
			| ArrayType
			| UnionType

		export type StringType = "string"
		export type NumberType = "number"
		export type IntegerType = "integer"
		export type BooleanType = "boolean"

		export type SimpleType = StringType | NumberType | IntegerType | BooleanType

		export enum Kind {
			Reference = "reference",
			Array = "array",
			Union = "union",
		}

		export type ReferenceType = {
			kind: Kind.Reference
			to: CustomTypeName
			inverse: string
			cardinality: "one-to-one" | "one-to-many" | "many-to-many" | "many-to-one"
		}

		export type ArrayType = {
			kind: Kind.Array
			of: CustomTypeName | SimpleType
		}

		export type UnionType = {
			kind: Kind.Union
			of: CustomTypeName[]
		}

		// TODO: read this from the schema itself
		export type CustomTypeName = string
	}
}

import schema = Insane.Schema
export type { schema }

export type InsaneReferenceTypeOptions = {
	inverse: string
	cardinality: "one-to-one" | "one-to-many" | "many-to-many" | "many-to-one"
}

export function isSimpleType(x: schema.Type): x is schema.SimpleType {
	return x === "string" || x === "integer" || x === "float" || x === "boolean"
}

export function isReferenceType(x: schema.Type): x is schema.ReferenceType {
	return typeof x === "object" && x.kind === schema.Kind.Reference
}

export function isArrayType(x: schema.Type): x is schema.ArrayType {
	return typeof x === "object" && x.kind === schema.Kind.Array
}

export function isUnionType(x: schema.Type): x is schema.UnionType {
	return typeof x === "object" && x.kind === schema.Kind.Union
}

export const t = {
	string: "string",
	float: "float",
	integer: "integer",
	boolean: "boolean",
	reference(
		to: Insane.Schema.CustomTypeName,
		options: InsaneReferenceTypeOptions,
	): Insane.Schema.ReferenceType {
		return {
			kind: schema.Kind.Reference,
			to,
			...options,
		}
	},
	array(of: schema.CustomTypeName): schema.ArrayType {
		return {
			kind: schema.Kind.Array,
			of,
		}
	},
	union(...arg: schema.CustomTypeName[]): schema.UnionType {
		return {
			kind: schema.Kind.Union,
			of: arg,
		}
	},
}
