import { EXPORTABLE } from "graphile-utils"
import { version } from "~/lib/version"

import type { PgSelectSingleStep } from "@dataplan/pg"
import { decode, encode } from "~/lib/uid/plan"

const id = EXPORTABLE(
	(encode) =>
		function ($document: PgSelectSingleStep) {
			return encode($document.get("uid"))
		},
	[encode],
)

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
						fields: {
							id: {
								description: "The globally unique identifier of the user.",
								type: new GraphQLNonNull(GraphQLID),
								extensions: {
									grafast: {
										plan: id,
									},
								},
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
								(decode, registry) =>
									function (_, args) {
										const $id = args.getRaw("id")
										const $username = args.getRaw("username")

										const hasId = !$id?.evalIs(undefined)
										const hasUsername = !$username?.evalIs(undefined)

										if (hasId && hasUsername) {
											throw new Error("only one of id or username can be passed")
										}

										if (hasId) {
											const $uid = decode($id!)
											return registry.pgResources.user.get({ uid: $uid })
										}

										if (hasUsername) {
											return registry.pgResources.user.get({ username: $username! })
										}

										throw new Error("id or username is required")
									},
								[decode, build.input.pgRegistry],
							),
						})),
						users: context.fieldWithHooks({ fieldName: "users" }, () => ({
							description: "Get all users.",
							type: new GraphQLNonNull(
								new GraphQLList(
									new GraphQLNonNull(build.getObjectTypeByName("User")),
								),
							),
							plan: EXPORTABLE(
								(registry) =>
									function () {
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
