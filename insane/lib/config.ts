import type { InsaneTypeDefinition } from "~/lib/schema"

export type InsaneConfig = {
	/**
	 * The files to look at for graphql queries.
	 *
	 * This accepts globs like (ie, `*.ts`)
	 *
	 * These files will be watched in watch mode.
	 *
	 * @default ["*.ts", "*.tsx"]
	 */
	include?: string[]

	/**
	 * Files to exclude when looking for graphql queries.
	 *
	 * These files will be ignored in watch mode.
	 *
	 * @default ["node_modules"]
	 */
	exclude?: string[]

	/**
	 * The types you will use in your application.
	 */
	types: InsaneTypeDefinition[]
}

export function defineConfig(config: InsaneConfig) {
	return config
}
