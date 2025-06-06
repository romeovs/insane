import { promises as fs } from "node:fs"
import * as path from "node:path"
import { exportSchemaAsString } from "graphile-export"

import { format } from "~/build/format"

import type { GraphQLSchema } from "graphql"
import { collect } from "~/build/docs"

import type { BuildOutput } from "~/build"
import { type OperationDocumentNode, getName } from "~/lib/document"
import { hash } from "~/lib/hash"
import index from "./template/index.ts?raw"
import process from "./template/process.ts?raw"

const dir = ".insane/generated"

export async function write(output: BuildOutput) {
	await Promise.all([
		writeFile({ filename: "index.ts", content: index }),
		writeFile({ filename: "process.ts", content: process }),
		writeFile({ filename: "schema.graphql", content: output.schema.sdl }),
		writeFile({ filename: "types.ts", content: output.types }),
		writeFile(printCode(output.schema.schema)),
		writeFile(printDocs(output.schema.schema)),
		writeFile(printOperations(output.operations)),
	])
}

type FileDescription = {
	filename: string
	content: string[] | string | Promise<string> | Promise<string[]>
	hash?: string
}

async function writeFile(defn: FileDescription | Promise<FileDescription>) {
	const file = await defn

	const type = path.extname(file.filename).substring(1)
	if (type !== "ts" && type !== "graphql") {
		throw new Error(`Invalid file type: ${type}`)
	}

	const fullpath = path.join(dir, file.filename)
	const parent = path.dirname(fullpath)

	const content = await file.content
	const src = typeof content === "string" ? content : content.join("\n")
	const fhash = file.hash ? file.hash : await hash(src)

	const header = printHeader(type, fhash)
	const formatted = await format(`${header}\n\n${src}`, type)

	await fs.mkdir(parent, { recursive: true })
	await fs.writeFile(fullpath, formatted)
}

async function printCode(schema: GraphQLSchema) {
	const { code } = await exportSchemaAsString(schema, {
		mode: "graphql-js",
	})

	const content = code
		// inline sql literal where possible
		.replaceAll(/\$\{sql\.literal\("([^"]+)"\)\}/g, "'$1'")
		// remove useless prototypes
		.replaceAll(/__proto__: null,?/g, "")

	return {
		filename: "schema.ts",
		content,
	}
}

async function printDocs(schema: GraphQLSchema) {
	const docs = await collect(schema)
	const content = `export const docs = ${JSON.stringify(docs)}`

	return {
		filename: "docs.ts",
		content,
	}
}

function printOperations(operations: OperationDocumentNode[]) {
	const sorted = Array.from(operations).sort(
		(a, b) => a.meta?.hash?.localeCompare(b.meta?.hash ?? "") ?? 0,
	)

	const content = `
		${sorted
			.map(
				(operation) =>
					`const ${getName(operation)} = ${JSON.stringify(operation)} as const`,
			)
			.join("\n")}

		export const sources = {
			byHash: {
				${sorted.map((operation) => `${JSON.stringify(operation?.meta?.hash)}: ${getName(operation)}\n`).join(",\n")}
			},
			bySdl: {
				${sorted.map((operation) => `${JSON.stringify(operation.loc?.source.body)}: ${getName(operation)}\n`).join(",\n")}
			},
		} as const
	`
	return {
		filename: "queries.ts",
		content,
	}
}

function printHeader(type: "ts" | "graphql", hash?: string) {
	const lines = ["THIS IS A GENERATED FILE: DO NOT EDIT"]

	if (hash) {
		lines.push(`hash: ${hash}`)
	}

	const comment = type === "ts" ? "// " : "# "
	return lines.map((line) => `${comment}${line}`).join("\n")
}
