import { promises as fs } from "node:fs"
import * as path from "node:path"
import { exportSchemaAsString } from "graphile-export"

import { format } from "~/build/format"
import type { InsaneOutput } from "~/build/graph"

import type { GraphQLSchema } from "graphql"
import { collect } from "~/build/docs"
import type { InsaneInput } from "~/build/input"
import type { Source, Sources } from "~/build/sources"
import index from "./template/index.mjs?raw"
import process from "./template/process.mjs?raw"

const dir = ".insane/generated"

export async function write(input: InsaneInput, output: InsaneOutput) {
	const [code, docs, sources] = await Promise.all([
		printCode(output.schema),
		printDocs(output.schema),
		printSources(input.sources),
	])

	await Promise.all([
		writeFile("ts", "index.mjs", index),
		writeFile("ts", "process.mjs", process),
		writeFile("ts", "schema.mjs", code),
		writeFile("ts", "docs.mjs", docs),
		writeFile("ts", "queries.ts", sources),
		writeFile("graphql", "schema.graphql", output.sdl),
	])
}

async function writeFile(type: "ts" | "graphql", filepath: string, content: string) {
	const fullpath = path.join(dir, filepath)
	const parent = path.dirname(fullpath)

	const formatted = await format(content, type)

	await fs.mkdir(parent, { recursive: true })
	await fs.writeFile(fullpath, formatted)
}

async function printCode(schema: GraphQLSchema) {
	const { code } = await exportSchemaAsString(schema, {
		mode: "graphql-js",
	})

	const clean = code
		// inline sql literal where possible
		.replaceAll(/\$\{sql\.literal\("([^"]+)"\)\}/g, "'$1'")
		// remove useless prototypes
		.replaceAll(/__proto__: null,?/g, "")

	return format(clean, "ts")
}

async function printDocs(schema: GraphQLSchema) {
	const docs = await collect(schema)
	return `export const docs = ${JSON.stringify(docs)}`
}

async function printSources(sources: Sources) {
	function name(source: Source) {
		return `query_${source.hash}`
	}

	const srces = sources.sources.sort((a, b) => a.hash.localeCompare(b.hash))

	return `
		// THIS IS A GENERATED FILE: DO NOT EDIT
		// hash: ${sources.hash}

		${srces.map((source) => `const ${name(source)} = ${JSON.stringify(source)} as const`).join("\n")}

		export const sources = {
			byHash: {
				${srces.map((source) => `${JSON.stringify(source.hash)}: ${name(source)}\n`).join(",\n")}
			},
			bySdl: {
				${srces.map((source) => `${JSON.stringify(source.sdl)}: ${name(source)}\n`).join(",\n")}
			},
		} as const
	`
}
