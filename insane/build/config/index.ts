import { find as findFile, watch as watchFiles } from "./finder"
import { read as readConfig, watch as watchConfig } from "./read"

type ConfigOptions = {
	candidates: string[]
	signal: AbortSignal
}

export async function read(options: ConfigOptions) {
	const { signal } = options
	const configFile = await findFile(options)
	if (!configFile) {
		throw new Error("No config file found")
	}
	return readConfig({ configFile, signal })
}

export async function* watch(options: ConfigOptions) {
	const { signal } = options
	for await (const configFile of watchFiles(options)) {
		for await (const config of watchConfig({ configFile, signal })) {
			yield config
		}
	}
}
