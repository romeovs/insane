export interface InsaneSchemaTypes {
	__internal: "insane_schema_types"
}

export type InsaneDataType = Exclude<keyof InsaneSchemaTypes, "__internal">
