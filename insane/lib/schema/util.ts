import { camelize as camelize_, humanize as humanize_, underscore } from "inflection"
export {
	pluralize,
	capitalize,
	classify,
} from "inflection"

export function camelize(str: string): string {
	return camelize_(str.replace(/-/g, "_"), true)
}

export function humanize(str: string): string {
	return humanize_(underscore(str))
}

export function assert(x: unknown, message: string): asserts x {
	if (!x) {
		throw new Error(message)
	}
}
