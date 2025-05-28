import * as path from "node:path"

import { Biome, Distribution } from "@biomejs/js-api"
import { createProject } from "@ts-morph/bootstrap"
import ts from "typescript"
import { expect, it } from "vitest"

import * as exportable from "./exportable-transformer"

async function setup(source: string) {
	const res = await transform(source, {
		transforms: [exportable.transform],
	})
	return format(res)
}

/**
 * Transform a TypeScript file given a project context and transform function
 * in a virtual filesystem
 *
 * @param file - File to use as project root
 * @param options - Options providing context to the transformation
 */
async function transform(
	source: string,
	options: {
		transforms?: ts.TransformerFactory<ts.SourceFile>[]
	} = {},
): Promise<string> {
	const project = await createProject({
		useInMemoryFileSystem: true,
		compilerOptions: {
			target: ts.ScriptTarget.ESNext,
		},
	})

	const inPath = "test.ts"

	project.createSourceFile(inPath, source)

	const program = project.createProgram()

	const { emitSkipped, diagnostics } = program.emit(
		program.getSourceFile(inPath),
		undefined,
		undefined,
		false,
		{
			before: options.transforms ?? [],
		},
	)

	if (emitSkipped) {
		throw new Error(project.formatDiagnosticsWithColorAndContext(diagnostics))
	}

	const sourceFile = program.getSourceFile(inPath)
	if (!sourceFile) {
		throw new Error(`Could not get sourceFile for ${inPath}`)
	}

	const compilerOptions = program.getCompilerOptions()
	const extname = path.extname(sourceFile.fileName)
	const basename = path.basename(sourceFile.fileName, extname)

	const outDir = compilerOptions.outDir || "."
	const outFile = path.join(outDir, `${basename}.js`)

	return project.fileSystem.readFile(outFile)
}

async function format(code: string) {
	const biome = await Biome.create({ distribution: Distribution.NODE })
	const { content } = biome.formatContent(code, {
		filePath: "./index.ts",
	})
	return content
}

it("should transform function declarations", async () => {
	const code = await setup(`
		const foo = 1

		function bar() {
			"use exportable"
			foo
		}
	`)

	expect(code).toEqual(
		await format(`
			const foo = 1;
			const bar = EXPORTABLE((foo) => function () {
				"use exportable";
				foo;
			}, [foo]);
	`),
	)
})

it("should transform function declarations expressions", async () => {
	const code = await setup(`
		const foo = 1

		const bar = function () {
			"use exportable"
			foo
		}
	`)
	expect(code).toEqual(
		await format(`
			const foo = 1;
			const bar = EXPORTABLE((foo) => function () {
				"use exportable";
				foo;
			}, [foo]);
	`),
	)
})

it("should transform object method declarations", async () => {
	const code = await setup(`
		const foo = 1
		const bar = {
			baz() {
				"use exportable"
				foo
			}
		}
	`)
	expect(code).toEqual(
		await format(`
			const foo = 1
			const bar = {
				baz: EXPORTABLE((foo) => function baz() {
					"use exportable"
					foo
				}, [foo])
			}
	`),
	)
})

it("should transform arrow function declarations", async () => {
	const code = await setup(`
		const foo = 1

		const bar = () => {
			"use exportable"
			foo
		}
	`)

	expect(code).toEqual(
		await format(`
			const foo = 1
			const bar = EXPORTABLE((foo) => () => {
				"use exportable"
				foo
			}, [foo])
	`),
	)
})

it("should ignore handle property accessors", async () => {
	const code = await setup(`
		const foo = { bar: { baz: 1 }}

		const quu = () => {
			"use exportable"
			foo.bar.baz
		}
	`)

	expect(code).toEqual(
		await format(`
			const foo = { bar: { baz: 1 }}
			const quu = EXPORTABLE((foo) => () => {
				"use exportable"
				foo.bar.baz
			}, [foo])
	`),
	)
})

it.skip("should ignore nested function declarations", async () => {
	const code = await setup(`
		const foo = 1

		const bar = () => {
			"use exportable"
			function baz (value) {
				foo + value
			}
		}
	`)

	expect(code).toEqual(
		await format(`
			const foo = 1
			const bar = EXPORTABLE((foo) => () => {
				"use exportable"
				function baz (value) {
					foo + value
				}
			}, [foo])
	`),
	)
})
