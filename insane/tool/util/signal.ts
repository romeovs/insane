import process from "node:process"

export function signal(signal: NodeJS.Signals, handler: () => void) {
	process.on(signal, () => {
		handler()
	})
}
