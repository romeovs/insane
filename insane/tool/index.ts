import { defineCommand, runMain } from "citty"

import build from "./build/command"
import dev from "./dev/command"

const main = defineCommand({
	meta: {
		name: "insane",
		description: "The Insane CLI tool.",
		version: "0.0.1", // TODO
	},
	subCommands: {
		dev,
		build,
	},
})

runMain(main)
