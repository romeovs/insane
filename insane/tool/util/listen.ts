import readline from "node:readline"

readline.emitKeypressEvents(process.stdin)
if (process.stdin.isTTY) {
	process.stdin.setRawMode(true)
}

type Keypress = {
	ctrl: boolean
	meta: boolean
	shift: boolean
	name: string
}

export function listen(key: string, handler: () => void) {
	const parts = key.split("+")
	const defn: Keypress = {
		ctrl: parts.includes("ctrl"),
		meta: parts.includes("meta"),
		shift: parts.includes("shift"),
		name: parts.at(-1)!,
	}

	process.stdin.on("keypress", function (_, evt: Keypress) {
		if (is(evt, defn)) {
			handler()
		}
	})
}

function is(evt: Keypress, defn: Keypress) {
	return (
		defn.ctrl === evt.ctrl &&
		defn.meta === evt.meta &&
		defn.shift === evt.shift &&
		defn.name === evt.name
	)
}
