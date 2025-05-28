import ts from "typescript"

export function isFunctionWithUseExport(
	node: ts.Node,
): node is ts.FunctionLikeDeclaration {
	if (
		!ts.isFunctionDeclaration(node) &&
		!ts.isFunctionExpression(node) &&
		!ts.isMethodDeclaration(node) &&
		!ts.isArrowFunction(node)
	) {
		return false
	}

	const body = node.body
	if (!body || !ts.isBlock(body)) {
		return false
	}

	const stmt = body?.statements[0]
	if (!stmt || !ts.isExpressionStatement(stmt)) {
		return false
	}

	if (!ts.isStringLiteral(stmt.expression)) {
		return false
	}

	return stmt.expression.text === "use exportable"
}

/**
 * Tells if a variable declaration list's declared variables are (implicitly) hoisted.
 *
 * `let` and `const` declarations are not hoisted: variables declared by
 * these keywords cannot be accessed until they are declared. Consequently,
 * earlier uses of `let`/`const` variables must refer to some other variable
 * declared in an enclosing scope.
 *
 * `var` declarations, on the other hand, are hoisted. This means that
 * that earlier uses in this scope of names declared by a `var` declaration
 * actually refer to said declaration.
 *
 * @param node A variable declaration list to inspect.
 */
export function isHoistedDeclaration(node: ts.VariableDeclarationList) {
	const isNotHoisted =
		(node.flags & ts.NodeFlags.Let) === ts.NodeFlags.Let ||
		(node.flags & ts.NodeFlags.Const) === ts.NodeFlags.Const

	return !isNotHoisted
}
