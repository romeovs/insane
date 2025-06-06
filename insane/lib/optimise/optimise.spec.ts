import { buildSchema, parse as graphql, print } from "graphql"

import { test } from "vitest"
import { optimise } from "."

const schema = buildSchema(`
	schema {
		query: Query
	}

	type Query {
		products: [Product!]!
	}

	type Product {
		id: ID!
		name: String!
		price: Int!
	}

	directive @info(hash: String!) on QUERY | MUTATION | FRAGMENT_DEFINITION
`)

const documents = [
	graphql(`
		query {
			products {
				...Foo
			}
		}
	`),

	graphql(`
		fragment Foo on Product {
			name
		}
	`),
]

test("optimise", async () => {
	const optimised = await optimise(schema, documents)

	for (const document of optimised.operations) {
		console.log(document)
		console.log(print(document))
		console.log("---")
	}
})
