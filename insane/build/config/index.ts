import { map, of, switchAll } from "rxjs"
import { find as findFile, watch as watchFiles } from "./finder"
import { read as readConfig, watch as watchConfig } from "./read"

type ConfigOptions = {
	candidates: string[]
}

export async function read(options: ConfigOptions) {
	const configFile = await findFile(options)
	if (!configFile) {
		throw new Error("No config file found")
	}
	return readConfig({ configFile })
}

export function watch(options: ConfigOptions) {
	return watchFiles(options).pipe(
		map((configFile) => {
			if (configFile instanceof Error) {
				return of(configFile)
			}
			return watchConfig({ configFile })
		}),
		switchAll(),
	)
}
