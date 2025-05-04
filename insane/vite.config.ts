import path from "node:path"
import { defineConfig } from "vite"
import tspaths from "vite-tsconfig-paths"

export default defineConfig({
	plugins: [tspaths()],
	build: {
		target: "esnext",
		ssr: true,
		rollupOptions: {
			input: {
				tool: path.resolve(__dirname, "tool"),
				config: path.resolve(__dirname, "config"),
				runtime: path.resolve(__dirname, "runtime"),
			},
		},
	},
})
