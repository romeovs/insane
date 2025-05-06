import { defineCommand } from "citty"

import { read as readConfig } from "~/build/config"
import { load as loadDocuments } from "~/build/documents"

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
		const config = await readConfig({
			candidates: parseConfigFile(ctx.args),
		})
		const documents = await loadDocuments({
			include: config.include ?? [],
			exclude: config.exclude ?? [],
		})

		console.log(config)
		console.log(documents)
	},
})
