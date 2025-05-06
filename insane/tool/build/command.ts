import { defineCommand } from "citty"

import { read as readConfig } from "~/build/config"
import { load as loadDocuments } from "~/build/documents"

export default defineCommand({
	meta: {
		description:
			"Watch for changes to the Insane config file and source code and rebuild.",
	},
	args: {
		configFile: {
			type: "string",
			description: "The path to the Insane config file.",
			required: false,
		},
	},
	async run(ctx) {
		const candidates = ctx.args.configFile
			? [ctx.args.configFile]
			: [
					"insane.config.ts",
					"insane.config.tsx",
					"insane.config.mjs",
					"insane.config.mjsx",
					"insane.config.js",
					"insane.config.jsx",
				]

		const controller = new AbortController()
		const signal = controller.signal

		const config = await readConfig({ candidates, signal })
		const documents = await loadDocuments({
			include: config.include ?? [],
			exclude: config.exclude ?? [],
		})

		console.log(config)
		console.log(documents)
	},
})
