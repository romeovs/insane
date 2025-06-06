import path from "node:path"
import dts from "vite-plugin-dts"
import tspaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [tspaths(), dts()],
	build: {
		target: "esnext",
		ssr: true,
		rollupOptions: {
			input: {
				tool: path.resolve(__dirname, "tool"),
				build: path.resolve(__dirname, "build"),
				config: path.resolve(__dirname, "config"),
				runtime: path.resolve(__dirname, "runtime"),
				plugin: path.resolve(__dirname, "plugin"),
			},
			output: {
				entryFileNames: "[name]/index.mjs",
			},
		},
	},
	test: {
		server: {
			deps: {
				fallbackCJS: true,
			},
		},
	},
})
