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

		export type Kind = "reference" | "array" | "union"

		export type ReferenceType = {
			kind: "reference"
			to: CustomTypeName
			inverse: string
			cardinality: "one-to-one" | "one-to-many" | "many-to-many" | "many-to-one"
		}

		export type ArrayType = {
			kind: "array"
			of: CustomTypeName | SimpleType
		}

		export type UnionType = {
			kind: "union"
			of: CustomTypeName[]
		}

		// TODO: read this from the schema itself
		export type CustomTypeName = string
	}
}

import schema = Insane.Schema

export type InsaneReferenceTypeOptions = {
	inverse: string
	cardinality: "one-to-one" | "one-to-many" | "many-to-many" | "many-to-one"
}

export function isSimpleType(x: schema.Type): x is schema.SimpleType {
	return x === "string" || x === "integer" || x === "float" || x === "boolean"
}

export function isReferenceType(x: schema.Type): x is schema.ReferenceType {
	return typeof x === "object" && x.kind === "reference"
}

export function isArrayType(x: schema.Type): x is schema.ArrayType {
	return typeof x === "object" && x.kind === "array"
}

export function isUnionType(x: schema.Type): x is schema.UnionType {
	return typeof x === "object" && x.kind === "union"
}

export const t = {
	string: "string",
	float: "float",
	integer: "integer",
	boolean: "boolean",
	reference(
		to: schema.CustomTypeName,
		options: InsaneReferenceTypeOptions,
	): schema.ReferenceType {
		return {
			kind: "reference",
			to,
			...options,
		}
	},
	array(of: schema.CustomTypeName): schema.ArrayType {
		return {
			kind: "array",
			of,
		}
	},
	union(...arg: schema.CustomTypeName[]): schema.UnionType {
		return {
			kind: "union",
			of: arg,
		}
	},
}
