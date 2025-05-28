import { promises as fs } from "node:fs"
import * as path from "node:path"

import type { InsaneOutput } from "~/build/graph"

import { format } from "./format"
export * from "./format"

import index from "./template/index.mjs?raw"
import process from "./template/process.mjs?raw"

const dir = ".insane/generated"

export async function write(output: InsaneOutput) {
	await Promise.all([
		_write("index.mjs", await format(index, "ts")),
		_write("process.mjs", await format(process, "ts")),
		_write("schema.graphql", await format(output.sdl, "graphql")),
		_write("schema.mjs", await format(clean(output.code), "ts")),
	])
}

function clean(code: string) {
	return code
		.replaceAll(/\$\{sql\.literal\("([^"]+)"\)\}/g, "'$1'")
		.replaceAll(/__proto__: null,?/g, "")
}

async function _write(filepath: string, content: string) {
	const fullpath = path.join(dir, filepath)
	const parent = path.dirname(fullpath)

	await fs.mkdir(parent, { recursive: true })
	await fs.writeFile(fullpath, content)
}
