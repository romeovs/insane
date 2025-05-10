import { version } from "~/lib/version"

export const RemoveEmptyDirectivesPlugin: GraphileConfig.Plugin = {
	name: "RemoveEmptyDirectivesPlugin",
	description:
		"Removes empty directives from extensions accross all entities of the schema",
	version,
	schema: {
		hooks: {
			GraphQLInputObjectType: simplify,
			GraphQLObjectType: simplify,
			GraphQLEnumType: simplify,
			GraphQLUnionType: simplify,
			GraphQLInterfaceType: simplify,
			GraphQLScalarType: simplify,
			GraphQLInputObjectType_fields_field: simplify,
			GraphQLObjectType_fields_field: simplify,
			GraphQLObjectType_fields_field_args_arg: simplify,
			GraphQLInterfaceType_fields_field: simplify,
			GraphQLInterfaceType_fields_field_args_arg: simplify,
		},
	},
}

type Extensions = {
	[attribute: string]: unknown
}

type WithExtensions = {
	extensions?: Extensions | null | undefined
}

function simplify<T extends WithExtensions>(type: T): T {
	if (!type.extensions) {
		return type
	}

	const { directives, ...rest } = type.extensions

	if (directives && Object.keys(directives).length > 0) {
		// Remove the directives key from extensions
		return { ...type, extensions: type.extensions }
	}

	return { ...type, extensions: rest }
}
