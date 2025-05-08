import {
	asyncScheduler,
	map,
	of,
	switchAll,
	throttleTime,
	withLatestFrom,
} from "rxjs"
import type { Observable } from "~/build/observable"

import {
	type ConfigWithHash,
	read as readConfig,
	watch as watchConfig,
} from "~/build/config"
import {
	type Sources,
	load as loadDocuments,
	watch as watchSources,
} from "~/build/documents"

export type InputOptions = {
	candidates: string[]
	throttle?: number
}

export type Input = {
	config: ConfigWithHash
	sources: Sources
}

export async function read(options: InputOptions) {
	const { candidates } = options
	const config = await readConfig({ candidates })
	const documents = await loadDocuments({
		include: config.include ?? [],
		exclude: config.exclude ?? [],
	})

	return {
		config,
		documents,
	}
}

export function watch(options: InputOptions): Observable<Input | Error> {
	const { candidates, throttle = 500 } = options
	return watchConfig({ candidates }).pipe(
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
		throttleTime(throttle, asyncScheduler, { leading: true, trailing: true }),
		map((input): Input | Error => {
			if (input instanceof Error) {
				return input
			}
			if (input.sources instanceof Error) {
				return input.sources
			}
			return {
				sources: input.sources,
				config: input.config,
			}
		}),
	)
}
