import path from "node:path"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"
import tspaths from "vite-tsconfig-paths"

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
			},
			output: {
				entryFileNames: "[name]/index.mjs",
			},
		},
	},
})
