import { version } from "~/lib/version"

export const ScalarsPlugin: GraphileConfig.Plugin = {
	name: "ScalarsPlugin",
	description: "Adds Scalar types",
	version,
	schema: {
		hooks: {
			init(_, build) {
				build.registerScalarType(
					"DateTime",
					{},
					() => ({
						description: "An ISO 8601 date/time string.",
						extensions: {
							directives: {
								specifiedBy: {
									url: "https://en.wikipedia.org/wiki/ISO_8601",
								},
							},
						},
					}),
					"DateTime for documents",
				)
				return _
			},
		},
	},
}
