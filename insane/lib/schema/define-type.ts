import type { InsaneField } from "./define-field"
import { camelize, capitalize, classify, humanize, pluralize } from "./util"

export type InsaneTypeDefinition = {
	name: string
	title?: string | undefined
	deprecated?: string | undefined
	description?: string | undefined

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

	fields: InsaneField[]
	validate?: (value: unknown) => string | null
}

export type InsaneType = {
	name: string
	title: string
	deprecated: string | null
	description: string | null

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

	fields: InsaneField[]
	validate: (value: unknown) => string | null
}

export function defineType(defn: InsaneTypeDefinition): InsaneType {
	const {
		name,
		title = capitalize(humanize(name)),
		names: { display = {}, graphql = {} } = {},
		validate = () => null,
		deprecated = null,
		description = null,
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
