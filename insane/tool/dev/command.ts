import { defineCommand } from "citty"

import { watch } from "~/build/config"

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

		watch({ candidates }).subscribe((config) => {
			console.log("CONFIG", config)
		})
	},
})
