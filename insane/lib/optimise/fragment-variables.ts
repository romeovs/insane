import { createGraphQLError } from "@graphql-tools/utils"
import {
	type ArgumentNode,
	type DocumentNode,
	type FragmentDefinitionNode,
	type InlineFragmentNode,
	Kind,
	visit,
} from "graphql"

export function applySelectionSetFragmentArguments(
	document: DocumentNode,
	fragments: Record<string, FragmentDefinitionNode>,
): DocumentNode {
	return visit(document, {
		FragmentSpread(fragmentNode, key, parent, path, ancestors) {
			// @ts-expect-error: we introduced fragmentNode.arguments
			const args: ArgumentNode[] = fragmentNode.arguments ?? []

			const fragment = fragments[fragmentNode.name.value]
			if (!fragment) {
				throw createGraphQLError(`Unknown fragment ${fragmentNode.name.value}`, {
					nodes: [fragmentNode],
					// TODO: add path and other metadata
				})
			}

			if (args?.length >= 1) {
				const byName: Record<string, ArgumentNode> = {}
				for (const arg of args) {
					byName[arg.name.value] = arg
				}

				// TODO: allow nested fragments with arguments?
				// TODO: test this

				const selectionSet = visit(fragment.selectionSet, {
					Variable(variableNode) {
						const arg = byName[variableNode.name.value]
						if (arg) {
							return arg.value
						}

						return variableNode
					},
				})

				return {
					kind: Kind.INLINE_FRAGMENT,
					typeCondition: fragment.typeCondition,
					selectionSet,
				} as InlineFragmentNode
			}
		},
	})
}
