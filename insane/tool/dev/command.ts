import { defineCommand } from "citty"

import { watch } from "~/build/config"
import { debounce } from "~/build/debounce"

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

		for await (const config of debounce(watch({ candidates, signal }), 200)) {
			console.log(config)
		}
	},
})
