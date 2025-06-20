import path from "node:path"
import { pathToFileURL } from "node:url"

import { type Observable, concatMap, filter, from, fromEventPattern } from "rxjs"

import glob from "fast-glob"
import type { RollupOutput, RollupWatcher, RollupWatcherEvent } from "rollup"
import { build as vite } from "vite"
import tspaths from "vite-tsconfig-paths"

import { distinctUntilChanged } from "~/build/observable"
import type { ValidInsaneConfig } from "~/lib/config"
import { dir } from "~/lib/constants"
import { hash } from "~/lib/hash"

const outDir = path.join(dir, "tmp")

export type ConfigWithHash = ValidInsaneConfig & { hash: string }

type ConfigOptions = {
	configFile: string
}

export async function read(options: ConfigOptions) {
	const { configFile } = options
	await makeVite(configFile)
	return readOutput()
}

export function watch(options: ConfigOptions): Observable<ConfigWithHash | Error> {
	const { configFile } = options

	return from(makeVite(configFile, true)).pipe(
		concatMap((watcher) =>
			fromEventPattern<RollupWatcherEvent>(
				function add(handler) {
					watcher.on("event", handler)
				},
				function remove(handler) {
					watcher.off("event", handler)
					watcher.close()
				},
			),
		),
		filter((evt) => evt.code === "END" || evt.code === "ERROR"),
		concatMap(async (evt) => {
			if (evt.code === "ERROR") {
				return evt.error as Error
			}
			try {
				return await readOutput()
			} catch (err) {
				return err as Error
			}
		}),
		distinctUntilChanged((a, b) => a.hash === b.hash),
	)
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
	const files = await glob(`${outDir}/entry.*.mjs`)
	if (files.length === 0) {
		throw new Error("Could not build config")
	}
	if (files.length > 1) {
		throw new Error("Could not build config")
	}

	return files[0]!
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
			outDir,
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
