import chokidar from "chokidar"
import micromatch from "micromatch"

import { dir } from "~/lib/constants"

import { type Observable, filter, fromEventPattern } from "rxjs"

type WatchOptions = {
	include: string[]
	exclude?: string[]
}

export function watch(options: WatchOptions): Observable<string> {
	const watcher = chokidar.watch(".", {
		ignored: ["**/.git", "**/node_modules", `**/${dir}`],
		persistent: true,
	})

	return fromEventPattern(
		function add(handler) {
			watcher.on("all", handler)
		},
		function remove(handler) {
			watcher.off("all", handler)
			watcher.close()
		},
		(_, pathname: string) => pathname,
	).pipe(filter((filename) => matches(filename, options)))
}

function matches(filename: string, options: WatchOptions) {
	return (
		micromatch.isMatch(filename, options.include) &&
		!micromatch.isMatch(filename, options.exclude ?? [])
	)
}
