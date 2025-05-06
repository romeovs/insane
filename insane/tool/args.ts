export const configFile = {
	type: "string",
	description: "The path to the Insane config file.",
	required: false,
} as const

export function parseConfigFile(args: { configFile?: string }) {
	if (args.configFile) {
		return [args.configFile]
	}
	return [
		"insane.config.ts",
		"insane.config.tsx",
		"insane.config.mjs",
		"insane.config.mjsx",
		"insane.config.js",
		"insane.config.jsx",
	]
}
