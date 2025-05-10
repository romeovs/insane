import { gatherConfig } from "graphile-build"

import type { ValidInsaneConfig } from "~/lib/config"
import { version } from "~/lib/version"

declare global {
	namespace GraphileBuild {
		interface BuildInput {
			config: ValidInsaneConfig
		}
	}
	namespace GraphileConfig {
		interface GatherHelpers {
			config: null
		}
	}
}

export function ConfigPlugin(config: ValidInsaneConfig): GraphileConfig.Plugin {
	return {
		name: "ConfigPlugin",
		description: "Provide the unsane config",
		version,
		gather: gatherConfig({
			namespace: "config",
			async main(output) {
				output.config = config
			},
		}),
	}
}
