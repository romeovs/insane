import { defineCommand } from "citty"

import { build } from "~/build/graph"
import { read as readInput } from "~/build/input"
import { write } from "~/build/write"
import { configFile, parseConfigFile } from "~/tool/args"

export default defineCommand({
	meta: {
		description:
			"Watch for changes to the Insane config file and source code and rebuild.",
	},
	args: {
		configFile,
	},
	async run(ctx) {
		const input = await readInput({
			candidates: parseConfigFile(ctx.args),
		})

		const output = await build(input.config)
		await write(output)
	},
})
