import { defineCommand } from "citty"

import { read as readInput } from "~/build/input"
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

		console.log(input.config)
		console.log(input.sources)
	},
})
