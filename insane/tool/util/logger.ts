import chalk from "chalk"
import { random } from "~/lib/random"

type Options = {
	id?: string
	sticky?: boolean
}

type Message =
	| {
			type: "message"
			ts: number
			level: "info" | "error"
			message: string
			sticky: boolean
			id: string
	  }
	| {
			type: "newline"
			ts: number
			sticky: boolean
			id: string
	  }

export class Logger {
	#messages: Message[] = []

	static color = chalk

	info(message: string, options: Options = {}) {
		return this.#log("info", message, options)
	}

	error(message: string, options: Options = {}) {
		return this.#log("error", message, options)
	}

	newline(options: Options = {}) {
		return this.#messages.push({
			type: "newline",
			ts: Date.now(),
			id: random(),
			sticky: options.sticky ?? false,
		})
	}

	#log(level: "info" | "error", message: string, options: Options) {
		return this.#push({
			type: "message" as const,
			ts: Date.now(),
			level,
			message,
			id: options.id ?? random(),
			sticky: options.sticky ?? false,
		})
	}

	#push(message: Message) {
		const idx = message.id
			? this.#messages.findIndex((msg) => message.id === msg.id)
			: -1

		if (idx >= 0) {
			// replace
			this.#messages[idx] = message
		} else {
			this.#messages.push(message)
		}

		this.#trim()
		this.#render()

		return { id: message.id }
	}

	#trim() {
		const res = []

		let kept = 0
		for (let idx = this.#messages.length - 1; idx >= 0; idx--) {
			const message = this.#messages[idx]!

			if (message.sticky) {
				res.unshift(message)
				continue
			}

			if (kept < 4) {
				kept++
				res.unshift(message)
			}
		}

		this.#messages = res
	}

	#render() {
		console.clear()
		console.log()
		for (const message of this.#messages) {
			if (message.type === "message") {
				const d = new Date(message.ts).toTimeString().split(" ")[0]
				const color = message.level === "info" ? chalk.reset : chalk.red
				console.log(` ${chalk.dim(d)}  ${color(message.message)}`)
			}
			if (message.type === "newline") {
				console.log()
			}
		}
	}
}
