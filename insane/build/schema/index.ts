import { promises as fs } from "node:fs"
import path from "node:path"
import ts, { factory as t } from "typescript"

import type { InsaneConfig } from "~/lib/config"
import { dir } from "~/lib/constants"

export async function generate(config: InsaneConfig) {
	// 1. validate
	// 2. write full schema

	// Extends the type map
	const iface = t.createInterfaceDeclaration(
		[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
		"InsaneSchemaTypes",
		[],
		[],
		config.types.map((type) =>
			t.createPropertySignature(
				[],
				type.name,
				undefined,
				t.createLiteralTypeNode(t.createTrue()),
			),
		),
	)

	const printer = ts.createPrinter()
	const src = printer.printNode(
		ts.EmitHint.Unspecified,
		iface,
		ts.createSourceFile("", "", ts.ScriptTarget.Latest),
	)

	await fs.mkdir(path.resolve(dir, "schema"), { recursive: true })
	await fs.writeFile(path.resolve(dir, "schema/index.d.ts"), src)
}
