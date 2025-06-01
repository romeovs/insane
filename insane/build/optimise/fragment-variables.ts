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
		FragmentSpread(fragmentNode) {
			// @ts-expect-error
			if (fragmentNode.arguments?.length >= 1) {
				const fragment = fragments[fragmentNode.name.value]
				if (!fragment) {
					throw new Error(`Unknown fragment ${fragmentNode.name.value}`)
				}

				const args: Record<string, ArgumentNode> = {}
				// @ts-expect-error
				for (const arg of fragmentNode.arguments) {
					args[arg.name.value] = arg
				}

				// TODO: allow nested fragments with arguments?

				const selectionSet = visit(fragment.selectionSet, {
					Variable(variableNode) {
						const arg = args[variableNode.name.value]
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
