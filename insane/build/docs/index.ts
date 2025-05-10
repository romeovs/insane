import Fuse, { type FuseIndexRecords } from "fuse.js"
import type { GraphQLSchema } from "graphql"
import { parse } from "marked"

export type DocEntry =
	| {
			type: "type"
			name: string
			description: string
	  }
	| {
			type: "field"
			name: string
			onType: string
			description: string
	  }

export type Docs = {
	readonly markdown: Record<string, string>
	readonly entries: readonly DocEntry[]
	readonly index: FuseIndex
}

export type FuseIndex = {
	keys: ReadonlyArray<string>
	records: FuseIndexRecords
}

export async function collect(schema: GraphQLSchema): Promise<Docs> {
	const entries: DocEntry[] = []
	const markdown: Record<string, string> = {}

	for (const typeName in schema.getTypeMap()) {
		const type = schema.getType(typeName)
		if (!type) {
			continue
		}

		entries.push({
			type: "type",
			name: typeName,
			description: type.description ?? "",
		})

		if (type.description) {
			markdown[type.description] = await parse(type.description)
		}

		const fields = "getFields" in type ? type.getFields() : {}
		for (const fieldName in fields) {
			const field = fields[fieldName]
			if (!field) {
				continue
			}

			entries.push({
				type: "field",
				name: fieldName,
				onType: typeName,
				description: field.description ?? "",
			})

			if (field.description) {
				markdown[field.description] = await parse(field.description)
			}
		}
	}

	const fuse = new Fuse(entries, {
		keys: [
			{ name: "name", weight: 10 },
			{ name: "onType", weight: 5 },
			{ name: "description", weight: 2 },
		],
	})

	const idx = fuse.getIndex().toJSON()

	return {
		entries,
		index: idx,
		markdown,
	}
}
