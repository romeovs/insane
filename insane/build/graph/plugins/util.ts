import { EXPORTABLE } from "graphile-utils"
import { type SQL, sql } from "pg-sql2"

export const field = EXPORTABLE(
	(sql) => (base: SQL | { alias: SQL }, name: string) => {
		const alias = "alias" in base ? base.alias : base
		return sql`${alias}.data->>${sql.literal(name)}`
	},
	[sql],
)
