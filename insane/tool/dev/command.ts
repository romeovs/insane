import { defineCommand } from "citty"

import { watch as watchInput } from "~/build/input"
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
		watchInput({
			candidates: parseConfigFile(ctx.args),
		}).subscribe((input) => {
			console.log(input)
		})
	},
})
