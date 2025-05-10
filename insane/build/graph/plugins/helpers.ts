import type {
	GraphQLEnumType,
	GraphQLInterfaceType,
	GraphQLObjectType,
	GraphQLScalarType,
} from "graphql"

import { version } from "~/lib/version"

declare global {
	namespace GraphileBuild {
		interface Build {
			getObjectTypeByName(name: string): GraphQLObjectType
			getInterfaceTypeByName(name: string): GraphQLInterfaceType
			getEnumTypeByName(name: string): GraphQLEnumType
			getScalarTypeByName(name: string): GraphQLScalarType
		}
	}
}

// biome-ignore lint/suspicious/noExplicitAny: we can't type the class here
type Class = new (...args: any[]) => any

function asType<T extends Class>(
	name: string,
	type: T,
	value: unknown,
): InstanceType<T> {
	if (!value) {
		throw new Error(`Type ${name} does not exist`)
	}

	if (value instanceof type) {
		// @ts-expect-error
		return value
	}

	throw new Error(`Type ${name} is not a ${type.name}`)
}

export const HelpersPlugin: GraphileConfig.Plugin = {
	name: "Helpers",
	description: "Adds helpers",
	version,
	schema: {
		hooks: {
			build(_, build) {
				return build.extend(
					build,
					{
						getInterfaceTypeByName(name: string): GraphQLInterfaceType {
							const type = build.getTypeByName(name)
							const { GraphQLInterfaceType } = build.graphql
							return asType(name, GraphQLInterfaceType, type)
						},
						getObjectTypeByName(name: string): GraphQLObjectType {
							const type = build.getTypeByName(name)
							const { GraphQLObjectType } = build.graphql
							return asType(name, GraphQLObjectType, type)
						},
						getEnumTypeByName(name: string): GraphQLEnumType {
							const type = build.getTypeByName(name)
							const { GraphQLEnumType } = build.graphql
							return asType(name, GraphQLEnumType, type)
						},
						getScalarTypeByName(name: string): GraphQLScalarType {
							const type = build.getTypeByName(name)
							const { GraphQLScalarType } = build.graphql
							return asType(name, GraphQLScalarType, type)
						},
					},
					"add helpers to build",
				)
			},
		},
	},
}
