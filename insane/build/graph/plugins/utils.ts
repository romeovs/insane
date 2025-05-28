import type {
	PgCodec,
	PgSelectParsedCursorStep,
	PgSelectSingleStep,
	PgSelectStep,
} from "@dataplan/pg"
import type { ConnectionStep } from "grafast"
import { EXPORTABLE } from "graphile-utils"
import type { GraphQLOutputType } from "graphql"
import { sql } from "pg-sql2"
import { isArrayType, isReferenceType, isUnionType } from "~/lib/schema"
import { encode } from "~/lib/uid/plan"

type DocumentResource =
	GraphileBuild.Build["input"]["pgRegistry"]["pgResources"]["document"]

export type DocumentStep = PgSelectSingleStep<DocumentResource>
export type DocumentsStep = PgSelectStep<DocumentResource>
export type DocumentsConnectionStep = ConnectionStep<
	PgSelectSingleStep<DocumentResource>,
	PgSelectParsedCursorStep,
	PgSelectStep<DocumentResource>,
	PgSelectSingleStep<DocumentResource>
>

export type Directives = {
	[name: string]: unknown
}

export const id = EXPORTABLE(
	(encode) =>
		function ($document: DocumentStep) {
			return encode($document.get("uid"))
		},
	[encode],
)

export function getter(type: PgCodec, ...path: (string | number)[]) {
	if (path.length === 0) {
		throw new Error("path cannot be empty")
	}

	if (path.length === 1) {
		const key = path[0]!.toString()
		return EXPORTABLE(
			(type, sql, key) => ($document: DocumentStep) => {
				const alias = $document.getClassStep().alias
				return $document.select(sql`${alias}.data->${sql.literal(key)}`, type)
			},
			[type, sql, key],
		)
	}

	const pth = path.map((el) => JSON.stringify(el)).join(",")
	return EXPORTABLE(
		(type, sql, pth) => ($document: DocumentStep) => {
			const alias = $document.getClassStep().alias
			return $document.select(sql`${alias}.data #> '{${sql.raw(pth)}}'`, type)
		},
		[type, sql, pth],
	)
}

export function graphQLType(
	build: GraphileBuild.Build,
	{ type, required }: { type: Insane.Schema.Type; required?: boolean },
): GraphQLOutputType {
	const {
		GraphQLNonNull,
		GraphQLString,
		GraphQLInt,
		GraphQLBoolean,
		GraphQLFloat,
		GraphQLList,
	} = build.graphql

	if (required) {
		const typ = graphQLType(build, { type, required: false })
		return new GraphQLNonNull(typ)
	}

	if (isReferenceType(type)) {
		if (type.cardinality === "one-to-many" || type.cardinality === "many-to-many") {
			const refedType = build.input.config.types.find((t) => t.name === type.to)
			if (!refedType) {
				throw new Error(`Type ${type.to} not found`)
			}
			return build.getObjectTypeByName(`${refedType.names.graphql.type}Connection`)
		}
		return graphQLType(build, { type: type.to, required })
	}
	if (isArrayType(type)) {
		return new GraphQLList(graphQLType(build, { type: type.of, required }))
	}
	if (isUnionType(type)) {
		throw new Error("Union types are not supported (yet!)")
	}

	switch (type) {
		case "string":
			return GraphQLString
		case "integer":
			return GraphQLInt
		case "float":
			return GraphQLFloat
		case "boolean":
			return GraphQLBoolean
	}

	const found = build.input.config.types.find((t) => t.name === type)
	if (found) {
		return build.getObjectTypeByName(found.names.graphql.type)
	}

	throw new Error(`Unsupported type ${type}`)
}
