import { defineCommand, runMain } from "citty"

import build from "./build/command"

const main = defineCommand({
	meta: {
		name: "insane",
		description: "The Insane CLI tool.",
		version: "0.0.1", // TODO
	},
	subCommands: {
		build,
	},
})

runMain(main)
