export interface InsaneSchemaTypes {
	__internal: "insane_schema_types"
}

type BuiltinType = "string" | "integer" | "float" | "boolean"

export type InsaneDataType =
	| Exclude<keyof InsaneSchemaTypes, "__internal">
	| BuiltinType
