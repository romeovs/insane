import {
	type DocumentNode as BaseDocumentNode,
	type ExecutableDefinitionNode,
	type FragmentDefinitionNode,
	Kind,
	type Location,
	type OperationDefinitionNode,
} from "graphql"

export type { BaseDocumentNode }

export type WithMeta<T> = T & {
	meta?: {
		hash?: string
	}
}

export type DocumentNode = WithMeta<BaseDocumentNode>

export type SingleDefinitionDocumentNode<
	T extends ExecutableDefinitionNode = ExecutableDefinitionNode,
> = WithMeta<{
	kind: typeof Kind.DOCUMENT
	definitions: [T]
	loc?: Location
}>

export type FragmentDocumentNode =
	SingleDefinitionDocumentNode<FragmentDefinitionNode>
export type OperationDocumentNode =
	SingleDefinitionDocumentNode<OperationDefinitionNode>

export function getDefinition(document: SingleDefinitionDocumentNode) {
	return document.definitions[0]
}

export function isOperation(
	document: SingleDefinitionDocumentNode,
): document is OperationDocumentNode {
	return getDefinition(document).kind === Kind.OPERATION_DEFINITION
}

export function isFragment(
	document: SingleDefinitionDocumentNode,
): document is FragmentDocumentNode {
	return getDefinition(document).kind === Kind.FRAGMENT_DEFINITION
}

export function getName(document: SingleDefinitionDocumentNode): string {
	return getDefinition(document).name?.value ?? ""
}
