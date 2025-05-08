import { mapValue, switchAll } from "~/build/observable"

import { find as findFile, watch as watchFiles } from "./finder"
import { read as readConfig, watch as watchConfig } from "./read"

export type { ConfigWithHash } from "./read.ts"

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
		mapValue((configFile) => watchConfig({ configFile })),
		switchAll(),
	)
}
