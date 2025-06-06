import type { Source } from "graphql"
import type { ParseOptions } from "graphql/language/parser.js"

import type { DocumentNode } from "~/lib/document"
import { hash } from "~/lib/hash"

import { FragmentArgumentCompatibleParser } from "./parser"

export async function parse(
	source: string | Source,
	options?: ParseOptions,
): Promise<DocumentNode> {
	const parser = new FragmentArgumentCompatibleParser(source, options)
	const document: DocumentNode = parser.parseDocument()

	document.meta ??= {}
	document.meta.hash = await hash(typeof source === "string" ? source : source.body)
	return document
}
