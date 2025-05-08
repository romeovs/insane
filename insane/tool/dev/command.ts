import { defineCommand } from "citty"

import {
	asyncScheduler,
	map,
	of,
	switchAll,
	throttleTime,
	withLatestFrom,
} from "rxjs"

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
				map((config) => {
					if (config instanceof Error) {
						return of(config)
					}
					return watchSources(config).pipe(
						withLatestFrom(of(config), (sources, config) => ({
							sources,
							config,
						})),
					)
				}),
				switchAll(),
				throttleTime(500, asyncScheduler, { leading: true, trailing: true }),
			)
			.subscribe((sources) => {
				console.log(sources)
			})
	},
})
