import { defineCommand } from "citty"
import { build } from "~/build"
import { watch as watchInput } from "~/build/input"
import { write } from "~/build/write"
import { version } from "~/lib/version"
import { configFile, parseConfigFile } from "~/tool/args"
import { Logger } from "~/tool/util/logger"

const check = Logger.color.green("✓")
const dot = Logger.color.yellow("◦")

export default defineCommand({
	meta: {
		description:
			"Watch for changes to the Insane config file and source code and rebuild.",
	},
	args: {
		configFile,
	},
	async run(ctx) {
		const log = new Logger()

		log.info(
			`Starting ${Logger.color.bold("insane")} (${Logger.color.magenta(version)}) in dev mode...`,
			{
				sticky: true,
			},
		)
		log.newline({ sticky: true })

		watchInput({
			candidates: parseConfigFile(ctx.args),
		}).subscribe(async (input) => {
			const start = Date.now()
			const id = Math.random().toFixed(10)

			const msg = log.info(`${dot} changes detected, generating...`, { id })
			if (input instanceof Error) {
				log.error(input.message)
				return
			}

			const output = await build(input)
			const time = Date.now() - start

			await write(output)
			log.info(`${check} Generated in ${Logger.color.gray(`${time}ms`)}`, {
				id: msg.id,
			})
		})
	},
})
