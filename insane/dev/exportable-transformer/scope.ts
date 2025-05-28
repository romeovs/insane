import type ts from "typescript"

/**
 * A lexical scope data structure that keeps track of captured variables.
 */
export class CapturedVariableScope {
	/**
	 * A list of all used variable identifiers.
	 */
	private used: ts.Identifier[]

	/**
	 * A list of all used variable names.
	 */
	private usedNames: string[]

	/**
	 * A list of all declared variables in the current scope.
	 */
	private declared: string[]

	/**
	 * Creates a captured variable scope.
	 * @param parent The parent node in the captured variable chain.
	 */
	constructor(public parent?: CapturedVariableScope) {
		this.used = []
		this.usedNames = []
		this.declared = []
	}

	/**
	 * Tells if a variable with a particular name is
	 * captured by this scope.
	 * @param name The name of the variable to check.
	 */
	isCaptured(name: ts.Identifier): boolean {
		return this.usedNames.indexOf(name.text) >= 0
	}

	/**
	 * Tells if a variable with a particular name is
	 * declared by this scope.
	 * @param name The name of the variable to check.
	 */
	isDeclared(name: ts.Identifier): boolean {
		return this.declared.indexOf(name.text) >= 0
	}

	/**
	 * Hints that the variable with the given name is
	 * used by this scope.
	 * @param name The name to capture.
	 */
	use(name: ts.Identifier): void {
		if (this.isCaptured(name) || this.isDeclared(name)) {
			return
		}

		this.used.push(name)
		this.usedNames.push(name.text)
		if (this.parent) {
			this.parent.use(name)
		}
	}

	/**
	 * Hints that the variable with the given name is
	 * declared by this scope in the chain.
	 * @param name The name to declare.
	 * @param isHoisted Tells if the variable is hoisted to the top of this scope.
	 */
	declare(name: ts.Identifier, isHoisted: boolean): void {
		if (this.isDeclared(name)) {
			return
		}

		this.declared.push(name.text)
		if (isHoisted) {
			// If the declaration is hoisted, then the uses we encountered previously
			// did not actually capture any external variables. We should delete them.
			const index = this.usedNames.indexOf(name.text)
			if (index >= 0) {
				this.usedNames.splice(index, 1)
				this.used.splice(index, 1)
			}
		}
	}

	/**
	 * Gets a read-only array containing all captured variables
	 * in this scope.
	 */
	get captured(): ts.Identifier[] {
		return this.used
	}
}
