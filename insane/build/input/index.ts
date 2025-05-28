import {
	asyncScheduler,
	concatMap,
	map,
	of,
	switchAll,
	throttleTime,
	withLatestFrom,
} from "rxjs"
import { hash } from "~/lib/hash"

import {
	type ConfigWithHash,
	read as readConfig,
	watch as watchConfig,
} from "~/build/config"
import type { Observable } from "~/build/observable"
import {
	type Sources,
	load as loadSources,
	watch as watchSources,
} from "~/build/sources"

export type InputOptions = {
	candidates: string[]
	throttle?: number
}

export type InsaneInput = {
	hash: string
	config: ConfigWithHash
	sources: Sources
}

export async function read(options: InputOptions) {
	const { candidates } = options
	const config = await readConfig({ candidates })
	const sources = await loadSources({
		include: config.include ?? [],
		exclude: config.exclude ?? [],
	})

	return {
		hash: await hash([config.hash, sources.hash].join("")),
		config,
		sources,
	}
}

export function watch(options: InputOptions): Observable<InsaneInput | Error> {
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
		concatMap(async (input): Promise<InsaneInput | Error> => {
			if (input instanceof Error) {
				return input
			}
			if (input.sources instanceof Error) {
				return input.sources
			}
			return {
				hash: await hash([input.config.hash, input.sources.hash].join("")),
				sources: input.sources,
				config: input.config,
			}
		}),
	)
}
