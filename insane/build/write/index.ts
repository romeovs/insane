import { promises as fs } from "node:fs"
import * as path from "node:path"

import { format } from "~/build/format"
import type { InsaneOutput } from "~/build/graph"

import index from "./template/index.mjs?raw"
import process from "./template/process.mjs?raw"

const dir = ".insane/generated"

export async function write(output: InsaneOutput) {
	await Promise.all([
		writeFile("ts", "index.mjs", index),
		writeFile("ts", "process.mjs", process),
		writeFile("ts", "schema.mjs", output.code),
		writeFile("ts", "docs.mjs", output.docs),
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
