import path from "node:path"
import { pathToFileURL } from "node:url"

import glob from "fast-glob"
import type { RollupOutput, RollupWatcher, RollupWatcherEvent } from "rollup"
import { build as vite } from "vite"
import tspaths from "vite-tsconfig-paths"

import type { InsaneConfig } from "~/lib/config"
import { dir } from "~/lib/constants"
import { hash } from "~/lib/hash"

const tmpDir = path.join(dir, "tmp")

type ConfigWithHash = InsaneConfig & { hash: string }

type ConfigOptions = {
	configFile: string
	signal: AbortSignal
}

export async function read(options: ConfigOptions) {
	const { configFile } = options
	await makeVite(configFile)
	return readOutput()
}

export async function* watch(options: ConfigOptions) {
	const { configFile, signal } = options
	const watcher = await makeVite(configFile, true)

	signal?.addEventListener("abort", () => watcher.close())

	let last = null

	for (;;) {
		try {
			await wait(watcher)
			const config = await readOutput()

			if (last === null || last !== config.hash) {
				// deduplicate the config by hash
				last = config.hash
				yield config
			}
		} catch (err) {
			if (err === undefined) {
				return
			}
			throw err
		}
	}
}

// read the built file
async function readOutput(): Promise<ConfigWithHash> {
	try {
		const filename = await findOutput()
		const file = pathToFileURL(filename).href
		const mod = await import(file)
		const config = mod.default
		const basename = path.basename(filename)
		config.hash = await hash(basename)
		return config
	} catch (err) {
		throw new Error("Could not import config")
	}
}

// find the built config file
async function findOutput() {
	const files = await glob(`${tmpDir}/entry.*.mjs`)
	if (files.length === 0) {
		throw new Error("Could not build config")
	}
	if (files.length > 1) {
		throw new Error("Could not build config")
	}

	return files[0]!
}

async function wait(watcher: RollupWatcher) {
	await new Promise(function (resolve, reject) {
		function handler(evt: RollupWatcherEvent) {
			if (evt.code !== "END") {
				return
			}

			watcher.off("event", handler)
			watcher.off("close", reject)

			resolve(null)
		}
		watcher.on("event", handler)
		watcher.on("close", reject)
	})
}

async function makeVite(configFile: string, watch: true): Promise<RollupWatcher>
async function makeVite(configFile: string, watch?: false): Promise<RollupOutput>
async function makeVite(
	configFile: string,
	watch = false,
): Promise<RollupWatcher | RollupOutput | RollupOutput[]> {
	return vite({
		configFile: false,
		logLevel: "silent",
		plugins: [tspaths()],
		build: {
			outDir: tmpDir,
			emptyOutDir: true,
			watch: watch ? {} : null,
			target: "esnext",
			ssr: true,
			sourcemap: true,
			ssrManifest: true,
			rollupOptions: {
				input: {
					config: configFile,
				},
				output: {
					entryFileNames: "entry.[hash].mjs",
				},
			},
		},
	})
}
