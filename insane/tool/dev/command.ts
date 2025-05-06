import { defineCommand } from "citty"

import { map, switchAll, throttleTime } from "rxjs"

import { watch as watchConfig } from "~/build/config"
import { watch as watchSources } from "~/build/documents"

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
		watchConfig({
			candidates: parseConfigFile(ctx.args),
		})
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
