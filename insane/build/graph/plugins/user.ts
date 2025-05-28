import { EXPORTABLE } from "graphile-utils"
import { version } from "~/lib/version"

import {
	type PgSelectQueryBuilderCallback,
	PgSelectSingleStep,
	type PgSelectStep,
} from "@dataplan/pg"
import { lambda } from "grafast"
import { sql } from "pg-sql2"
import { decode, encode } from "~/lib/uid/plan"

type UserResource = GraphileBuild.Build["input"]["pgRegistry"]["pgResources"]["user"]

type UserStep = PgSelectSingleStep<UserResource>
type UsersStep = PgSelectStep<UserResource>

export const UserPlugin: GraphileConfig.Plugin = {
	name: "UserPlugin",
	description: "Adds connection types for builtin scalars",
	version,
	schema: {
		hooks: {
			init(_, build) {
				const { GraphQLNonNull, GraphQLID, GraphQLString } = build.graphql

				build.registerObjectType(
					"User",
					{},
					() => ({
						name: "User",
						interfaces: () => [build.getInterfaceTypeByName("Node")],
						assertStep: PgSelectSingleStep,
						fields: {
							id: {
								description: "The globally unique identifier of the user.",
								type: new GraphQLNonNull(GraphQLID),
								plan: EXPORTABLE(
									(encode) =>
										function ($document: UserStep) {
											return encode($document.get("uid"))
										},
									[encode],
								),
							},
							username: {
								description:
									"The users' username. This username is unique, but can change over time.",
								type: GraphQLString,
							},
						},
					}),
					"User type",
				)

				return _
			},
			GraphQLObjectType_fields(fields, build, context) {
				if (context.Self.name !== "Query") {
					return fields
				}

				const { GraphQLNonNull, GraphQLList, GraphQLID, GraphQLString } =
					build.graphql

				return build.extend(
					fields,
					{
						user: context.fieldWithHooks({ fieldName: "user" }, () => ({
							type: build.getObjectTypeByName("User"),
							args: {
								id: {
									type: GraphQLID,
								},
								username: {
									type: GraphQLString,
								},
							},
							description: "Get a user",
							extensions: {
								directives: {
									oneOf: {},
								},
							},
							plan: EXPORTABLE(
								(decode, registry, sql, lambda) =>
									function (_, args) {
										const $id = args.getRaw("id")
										const $username = args.getRaw("username")

										const $filter = lambda(
											[decode($id), $username],
											([id, username]): PgSelectQueryBuilderCallback => {
												return (qb) => {
													if (id !== undefined && username !== undefined) {
														throw new Error(
															"only one of id or username can be passed",
														)
													}
													if (id === undefined && username === undefined) {
														throw new Error(
															"at least one of id or username must be passed",
														)
													}
													if (id !== undefined) {
														return qb.where(sql`${qb.alias}.uid = ${sql.value(id)}`)
													}
													if (username !== undefined) {
														return qb.where(
															sql`${qb.alias}.username = ${sql.value(username)}`,
														)
													}
												}
											},
											true,
										)

										const $select = registry.pgResources.user.find()
										$select.apply($filter)
										return $select.single()
									},
								[decode, build.input.pgRegistry, sql, lambda],
							),
						})),
						// @ts-expect-error
						users: context.fieldWithHooks({ fieldName: "users" }, () => ({
							description: "Get all users.",
							type: new GraphQLNonNull(
								new GraphQLList(
									new GraphQLNonNull(build.getObjectTypeByName("User")),
								),
							),
							plan: EXPORTABLE(
								(registry) =>
									function (): UsersStep {
										return registry.pgResources.user.find()
									},
								[build.input.pgRegistry],
							),
						})),
					},
					"adding user to Query",
				)
			},
		},
	},
}
