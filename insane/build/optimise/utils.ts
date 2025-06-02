import { type DocumentNode, Kind, visit } from "graphql"
import { random } from "~/lib/random"

export function addOperationName(document: DocumentNode) {
	return visit(document, {
		OperationDefinition: {
			enter(node) {
				if (node.name) {
					return
				}
				return {
					...node,
					name: {
						kind: Kind.NAME,
						value: `unnamed_${random()}_`,
					},
				}
			},
		},
	})
}

export function addInfo(document: DocumentNode, hash: string) {
	return visit(document, {
		enter(node) {
			if (
				node.kind !== Kind.OPERATION_DEFINITION &&
				node.kind !== Kind.FRAGMENT_DEFINITION
			) {
				return
			}

			return {
				...node,
				directives: [
					...(node.directives ?? []),
					{
						kind: Kind.DIRECTIVE,
						name: {
							kind: Kind.NAME,
							value: "info",
						},
						arguments: [
							{
								kind: Kind.ARGUMENT,
								name: {
									kind: Kind.NAME,
									value: "hash",
								},
								value: {
									kind: Kind.STRING,
									value: hash,
									block: false,
								},
							},
						],
					},
				],
			}
		},
	})
}

export function removeInfo(document: DocumentNode) {
	return visit(document, {
		enter(node) {
			if (
				node.kind !== Kind.OPERATION_DEFINITION &&
				node.kind !== Kind.FRAGMENT_DEFINITION
			) {
				return
			}

			return {
				...node,
				directives: node.directives?.filter(
					(directive) => directive.name.value !== "info",
				),
			}
		},
	})
}

export function getHash(document: DocumentNode) {
	let hash: string | null = null
	visit(document, {
		enter(node) {
			if (
				node.kind !== Kind.OPERATION_DEFINITION &&
				node.kind !== Kind.FRAGMENT_DEFINITION
			) {
				return
			}
			if (!node.directives) {
				return
			}
			if (node.directives.length < 1) {
				return
			}
			const directive = node.directives[0]
			if (directive?.name.value !== "info") {
				return
			}
			const argument = directive.arguments?.find(
				(argument) => argument.name.value === "hash",
			)
			if (!argument) {
				return
			}
			if (argument.value.kind !== Kind.STRING) {
				return
			}
			const value = argument.value.value
			hash = value
		},
	})

	if (!hash) {
		throw new Error("Missing hash")
	}

	return hash
}
