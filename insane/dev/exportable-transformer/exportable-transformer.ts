import ts from "typescript"

import { CapturedVariableScope } from "./scope"
import { isFunctionWithUseExport, isHoistedDeclaration } from "./util"

/**
 * A ts transformer that wraps functions marked with "use exportable" in
 * an EXPORTABLE closure that marks all the function's captured variables.
 *
 * @example
 *  // this source function
 *  function foo(a, b) {
 *    "use exportable"
 *
 *    bar(a) + baz(b) + c
 *  }
 *
 *  // becomes
 *  const foo = EXPORTABLE((bar, baz, c) => function foo(a, b) {
 *    "use exportable"
 *
 *    bar(a) + baz(b) + c
 *  }, [bar, baz, c])
 *
 *  @TODO -
 *    Only use the deepest nested value.
 *    ie. foo.bar.baz should capture foo.bar.baz as _foo_bar_baz.
 *
 *  @TODO -
 *    do not capture variables that are args of
 *    functions defined within the scope.
 */
export const transform: ts.TransformerFactory<ts.SourceFile> = (context) =>
	function (sourceFile: ts.SourceFile) {
		return ts.visitNode(
			sourceFile,
			visitor(context),
			ts.isSourceFile,
		) as ts.SourceFile
	}

/**
 * Creates a lambda that can be evaluated to a key-value
 * mapping for captured variables.
 * @param capturedVariables The list of captured variables.
 */
function createClosureLambda(capturedVariables: ReadonlyArray<ts.Identifier>) {
	// Synthesize a lambda that has the following format:
	//
	//     () => { a, b, ... }
	//
	// where a, b, ... is the list of captured variables.
	//
	// First step: create the object literal returned by the lambda.
	const objLiteralElements: ts.ObjectLiteralElementLike[] = []

	for (const variable of capturedVariables) {
		objLiteralElements.push(ts.factory.createShorthandPropertyAssignment(variable))
	}

	// Create the lambda itself.
	return ts.factory.createArrowFunction(
		[],
		[],
		[],
		undefined,
		undefined,
		ts.factory.createObjectLiteralExpression(objLiteralElements),
	)
}

/**
 * Creates an expression that produces a closure lambda
 * and assigns it to the closure property.
 * @param closureFunction The function whose closure property
 * is to be set.
 * @param capturedVariables The list of captured variables to
 * include in the closure lambda.
 */
function createClosurePropertyAssignment(
	closureFunction: ts.Expression,
	capturedVariables: ReadonlyArray<ts.Identifier>,
): ts.BinaryExpression {
	return ts.factory.createAssignment(
		ts.factory.createPropertyAccessExpression(closureFunction, "__closure"),
		createClosureLambda(capturedVariables),
	)
}

function wrapFunctionLike(
	_ctx: ts.TransformationContext,
	fn: ts.Expression,
	capturedVariables: ts.Identifier[],
) {
	const wrapper = ts.factory.createArrowFunction(
		[],
		[],
		capturedVariables.map((variable) =>
			ts.factory.createParameterDeclaration([], undefined, variable),
		),
		undefined,
		undefined,
		fn,
	)

	const args = ts.factory.createArrayLiteralExpression(capturedVariables)

	return ts.factory.createCallExpression(
		ts.factory.createIdentifier("EXPORTABLE"),
		[],
		[wrapper, args],
	)
}

/**
 * Creates a node visitor from a transformation context.
 * @param ctx The transformation context to use.
 */
function visitor(ctx: ts.TransformationContext) {
	/**
	 * Transforms an arrow function or function expression
	 * to include a closure property.
	 * @param node The node to transform.
	 * @param parentChain The captured variable chain of the parent function.
	 */
	function transformLambda(
		node: ts.ArrowFunction | ts.FunctionExpression,
		parentChain: CapturedVariableScope,
	): ts.VisitResult<ts.Node> {
		const chain = new CapturedVariableScope(parentChain)

		// Declare the function expression's name.
		if (node.name) {
			parentChain.declare(node.name, false)
			chain.declare(node.name, false)
		}

		// Declare the function declaration's parameters.
		for (const param of node.parameters) {
			visitDeclaration(param.name, chain, false)
		}

		// Visit the lambda and extract captured symbols.
		const { visited, captured } = visitAndExtractCapturedSymbols(node, chain)

		// return addClosurePropertyToLambda(ctx, visited, captured)
		return wrapFunctionLike(ctx, visited, captured)
	}

	/**
	 * Transforms a function declaration to include a closure property.
	 * @param node The node to transform.
	 * @param parentChain The captured variable chain of the parent function.
	 */
	function transformFunctionDeclaration(
		node: ts.FunctionDeclaration,
		parentChain: CapturedVariableScope,
	): ts.VisitResult<ts.Node> {
		const chain = new CapturedVariableScope(parentChain)

		// Declare the function declaration's name.
		if (node.name) {
			parentChain.declare(node.name, true)
			chain.declare(node.name, true)
		}

		// Declare the function declaration's parameters.
		for (const param of node.parameters) {
			visitDeclaration(param.name, chain, false)
		}

		if (!node.body) {
			return node
		}

		// Visit the function and extract captured symbols.
		const { visited, captured } = visitAndExtractCapturedSymbols(
			node.body,
			chain,
			node,
		)

		if (captured.length === 0) {
			return node
		}

		const funcExpression = ts.factory.createFunctionExpression(
			[],
			node.asteriskToken,
			undefined,
			node.typeParameters,
			node.parameters,
			node.type,
			visited,
		)

		return ts.factory.createVariableDeclarationList(
			[
				ts.factory.createVariableDeclaration(
					node.name?.text,
					undefined,
					undefined,
					wrapFunctionLike(ctx, funcExpression, captured),
				),
			],
			ts.NodeFlags.Const,
		)
	}

	/**
	 * Transforms a method declaration to include a closure property.
	 * @param node The node to transform.
	 * @param parentChain The captured variable chain of the parent function.
	 */
	function transformMethodDeclaration(
		node: ts.MethodDeclaration,
		parentChain: CapturedVariableScope,
	): ts.VisitResult<ts.Node> {
		const chain = new CapturedVariableScope(parentChain)

		// Declare the function declaration's name.
		if (node.name) {
			parentChain.declare(node.name, true)
			chain.declare(node.name, true)
		}

		// Declare the function declaration's parameters.
		for (const param of node.parameters) {
			visitDeclaration(param.name, chain, false)
		}

		if (!node.body) {
			return node
		}

		// Visit the function and extract captured symbols.
		const { visited, captured } = visitAndExtractCapturedSymbols(
			node.body,
			chain,
			node,
		)

		if (captured.length === 0) {
			return node
		}

		const funcExpression = ts.factory.createFunctionExpression(
			undefined,
			node.asteriskToken,
			node.name,
			node.typeParameters,
			node.parameters,
			node.type,
			visited,
		)

		return ts.factory.createPropertyAssignment(
			node.name?.text,
			wrapFunctionLike(ctx, funcExpression, captured),
		)
	}

	/**
	 * Visits a node and extracts all used identifiers.
	 * @param node The node to visit.
	 * @param chain The captured variable chain of the node.
	 * @param scopeNode A node that defines the scope from
	 * which eligible symbols are extracted.
	 */
	function visitAndExtractCapturedSymbols<T extends ts.Node>(
		node: T,
		chain: CapturedVariableScope,
		scopeNode?: ts.Node,
	): { visited: T; captured: ts.Identifier[] } {
		scopeNode = scopeNode || node

		// Visit the body of the arrow function.
		const visited = ts.visitEachChild(node, visitor(chain), ctx)

		// Figure out which symbols are captured and return.
		return { visited, captured: chain.captured }
	}

	function visitDeclaration(
		declaration: ts.Node,
		captured: CapturedVariableScope,
		isHoisted: boolean,
	) {
		function visit(node: ts.Node): ts.VisitResult<ts.Node> {
			if (ts.isIdentifier(node)) {
				captured.declare(node, isHoisted)
				return node
			}

			return ts.visitEachChild(node, visit, ctx)
		}

		return visit(declaration)
	}

	/**
	 * Creates a visitor.
	 * @param captured The captured variable chain to update.
	 */
	function visitor(captured: CapturedVariableScope): ts.Visitor {
		function recurse<T extends ts.Node>(node: T): T {
			return <T>visitor(captured)(node)
		}

		return function (node) {
			if (ts.isIdentifier(node)) {
				if (
					node.text !== "undefined" &&
					node.text !== "null" &&
					node.text !== "arguments"
				) {
					captured.use(node)
				}
				return node
			}
			if (ts.isTypeNode(node)) {
				// Don't visit type nodes.
				return node
			}
			if (ts.isPropertyAccessExpression(node)) {
				// Make sure we don't accidentally fool ourselves
				// into visiting property name identifiers.
				return ts.factory.updatePropertyAccessExpression(
					node,
					recurse(node.expression),
					node.name,
				)
			}

			if (ts.isQualifiedName(node)) {
				// Make sure we don't accidentally fool ourselves
				// into visiting the right-hand side of a qualified name.
				return ts.factory.updateQualifiedName(node, recurse(node.left), node.right)
			}

			if (ts.isPropertyAssignment(node)) {
				// Make sure we don't accidentally fool ourselves
				// into visiting property name identifiers.
				return ts.factory.updatePropertyAssignment(
					node,
					node.name,
					recurse(node.initializer),
				)
			}

			if (ts.isVariableDeclarationList(node)) {
				// Before we visit the individual variable declarations, we want to take
				// a moment to tell whether those variable declarations are implicitly
				// hoisted or not.
				const isHoisted = isHoistedDeclaration(node)

				// Now visit the individual declarations...
				const newDeclarations = []
				for (const declaration of node.declarations) {
					// ...making sure that we take their hoisted-ness into account.
					visitDeclaration(declaration.name, captured, isHoisted)
					newDeclarations.push(
						ts.visitEachChild(declaration, visitor(captured), ctx),
					)
				}
				// Finally, update the declaration list.
				return ts.factory.updateVariableDeclarationList(node, newDeclarations)
			}

			if (ts.isVariableDeclaration(node)) {
				visitDeclaration(node.name, captured, false)
				return ts.visitEachChild(node, visitor(captured), ctx)
			}

			if (isFunctionWithUseExport(node)) {
				if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
					return transformLambda(node, captured)
				}

				if (ts.isFunctionDeclaration(node)) {
					return transformFunctionDeclaration(node, captured)
				}

				if (ts.isMethodDeclaration(node)) {
					return transformMethodDeclaration(node, captured)
				}
			}

			return ts.visitEachChild(node, visitor(captured), ctx)
		}
	}

	return visitor(new CapturedVariableScope())
}
