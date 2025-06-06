import { type DocumentNode, Kind } from "graphql"
import type { SingleDefinitionDocumentNode } from "~/lib/document"

// Splits documents so that each document only has one definition.
export function split(docs: DocumentNode[]): SingleDefinitionDocumentNode[] {
	return docs.flatMap((doc) => {
		if (
			doc.definitions.filter((def) => def.kind === Kind.OPERATION_DEFINITION)
				.length > 1
		) {
			// TODO: add location to error
			throw new Error("Query must have only one operation")
		}
		return doc.definitions
			.filter(
				(def) =>
					def.kind === Kind.FRAGMENT_DEFINITION ||
					def.kind === Kind.OPERATION_DEFINITION,
			)
			.map((definition) => ({
				kind: Kind.DOCUMENT,
				definitions: [definition],
				loc: definition.loc,
			}))
	})
}
