import type { InsaneField } from "./define-field"
import { camelize, capitalize, classify, humanize, pluralize } from "./util"

type FieldName<Fields extends InsaneField<string>[]> = Fields[number]["name"]

export type InsaneTypeDefinition<Fields extends InsaneField<string>[]> = {
	name: string
	title?: string | undefined
	deprecated?: string | undefined
	description?: string | undefined

	fields: Fields

	names?: {
		display?: {
			plural?: string
		}
		graphql?: {
			singular?: string
			plural?: string
			type?: string
		}
	}
	uniques?: {
		[name: string]: FieldName<Fields>[] | FieldName<Fields>
	}
	validate?: (value: unknown) => string | null
}

export type InsaneType<
	Fields extends InsaneField<string>[] = InsaneField<string>[],
> = {
	name: string
	title: string
	deprecated: string | null
	description: string | null

	fields: Fields
	validate: (value: unknown) => string | null
	uniques: {
		[name: string]: FieldName<Fields>[]
	}

	names: {
		display: {
			singular: string
			plural: string
		}
		graphql: {
			singular: string
			plural: string
			type: string
		}
	}
}

export function defineType<const Fields extends InsaneField<string>[]>(
	defn: InsaneTypeDefinition<Fields>,
): InsaneType<Fields> {
	const {
		name,
		title = capitalize(humanize(name)),
		names: { display = {}, graphql = {} } = {},
		validate = () => null,
		deprecated = null,
		description = null,
		uniques = {},
	} = defn

	return {
		...defn,
		name: validateName(name),
		deprecated,
		description,
		title,
		names: {
			display: {
				singular: title ?? humanize(name),
				plural: display.plural ?? pluralize(title),
			},
			graphql: {
				singular: validateGraphqlName(graphql.singular ?? camelize(defn.name)),
				plural: validateGraphqlName(
					graphql.plural ?? camelize(pluralize(defn.name)),
				),
				type: validateGraphqlTypeName(graphql.type ?? classify(camelize(defn.name))),
			},
		},
		validate,
		uniques: Object.fromEntries(
			Object.entries(uniques).map(([key, value]) => [
				key,
				Array.isArray(value) ? value : [value],
			]),
		),
	}
}

function validateName(name: string) {
	if (!/[a-zA-Z][a-zA-Z0-9_-]*/.test(name)) {
		throw new Error(`Invalid type name: ${name}`)
	}
	return name
}

function validateGraphqlName(name: string) {
	if (!/[a-zA-Z][a-zA-Z0-9_]*/.test(name)) {
		throw new Error(`Invalid GraphQL name: ${name}`)
	}
	return name
}

function validateGraphqlTypeName(name: string) {
	if (!/[A-Z][a-zA-Z0-9_]*/.test(name)) {
		throw new Error(`Invalid GraphQL type name: ${name}`)
	}
	return name
}
