import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
	plugins: [],
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
