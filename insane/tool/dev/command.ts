import { defineCommand } from "citty"
import { build } from "~/build"
import { watch as watchInput } from "~/build/input"
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
		watchInput({
			candidates: parseConfigFile(ctx.args),
		}).subscribe(async (input) => {
			if (input instanceof Error) {
				console.error(input)
				return
			}

			const output = await build(input)
			await write(output)
		})
	},
})
