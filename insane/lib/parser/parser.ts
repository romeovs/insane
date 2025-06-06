import {
	type FragmentDefinitionNode,
	type FragmentSpreadNode,
	type InlineFragmentNode,
	Kind,
	Location,
	type Token,
	TokenKind,
} from "graphql"
import type { Lexer } from "graphql/language/lexer.js"
import { type ParseOptions, Parser } from "graphql/language/parser.js"

export class FragmentArgumentCompatibleParser extends Parser {
	get lexer(): Lexer {
		return this._lexer
	}

	get options(): ParseOptions {
		return this._options
	}

	// for backwards-compat with v15, this api was removed in v16 in favor of the this.node API.
	loc(startToken: Token): Location | undefined {
		if (this.options?.noLocation !== true) {
			return new Location(startToken, this.lexer.lastToken, this.lexer.source)
		}
		return undefined
	}

	parseFragment() {
		const start = this.lexer.token
		this.expectToken(TokenKind.SPREAD)
		const hasTypeCondition = this.expectOptionalKeyword("on")

		if (!hasTypeCondition && this.peek(TokenKind.NAME)) {
			const name = this.parseName()

			if (this.peek(TokenKind.PAREN_L)) {
				return this.node<FragmentSpreadNode>(start, {
					kind: Kind.FRAGMENT_SPREAD,
					name,
					// @ts-expect-error
					arguments: this.parseArguments(false),
					directives: this.parseDirectives(false),
					loc: this.loc(start),
				})
			}

			return this.node<FragmentSpreadNode>(start, {
				kind: Kind.FRAGMENT_SPREAD,
				name,
				directives: this.parseDirectives(false),
				loc: this.loc(start),
			})
		}

		return this.node<InlineFragmentNode>(start, {
			kind: Kind.INLINE_FRAGMENT,
			typeCondition: hasTypeCondition ? this.parseNamedType() : undefined,
			directives: this.parseDirectives(false),
			selectionSet: this.parseSelectionSet(),
			loc: this.loc(start),
		})
	}

	parseFragmentDefinition() {
		const start = this.lexer.token
		this.expectKeyword("fragment")
		const name = this.parseFragmentName()

		if (this.peek(TokenKind.PAREN_L)) {
			const variableDefinitions = this.parseVariableDefinitions()
			this.expectKeyword("on")

			return this.node<FragmentDefinitionNode>(start, {
				kind: Kind.FRAGMENT_DEFINITION,
				name,
				variableDefinitions,
				typeCondition: this.parseNamedType(),
				directives: this.parseDirectives(false),
				selectionSet: this.parseSelectionSet(),
				loc: this.loc(start),
			})
		}

		this.expectKeyword("on")

		return this.node<FragmentDefinitionNode>(start, {
			kind: Kind.FRAGMENT_DEFINITION,
			name,
			typeCondition: this.parseNamedType(),
			directives: this.parseDirectives(false),
			selectionSet: this.parseSelectionSet(),
			loc: this.loc(start),
		})
	}
}
