import { Biome, Distribution } from "@biomejs/js-api"

export async function format(code: string, type: "ts" | "graphql") {
	const biome = await Biome.create({
		distribution: Distribution.NODE,
	})

	const { content } = biome.formatContent(code, {
		filePath: `./index.${type}`,
	})
	return content
}
