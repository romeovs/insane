import { defineCommand } from "citty"

import { map, switchAll, throttleTime } from "rxjs"

import { watch as watchConfig } from "~/build/config"
import { watch as watchSources } from "~/build/documents"

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

		watchConfig({ candidates })
			.pipe(
				map((config) =>
					watchSources(config).pipe(map((sources) => ({ sources, config }))),
				),
			)
			.pipe(switchAll())
			.pipe(throttleTime(100))
			.subscribe((sources) => {
				console.log(sources)
			})
	},
})
