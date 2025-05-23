import {
	applyTransforms,
	context as context_,
	each,
	object,
	sideEffect,
} from "grafast"
import { EXPORTABLE } from "graphile-utils"
import { type DocumentStep, type DocumentsStep, id } from "./utils"

declare global {
	namespace Grafast {
		interface Context {
			items: Set<string>
		}
	}
}

export const track = EXPORTABLE(
	(context, sideEffect, id) => ($document: DocumentStep) => {
		const $items = context().get("items")
		const $type = $document.get("type")
		const $id = id($document)

		sideEffect([$items, $type, $id], ([items, type, id]) => {
			if (type && id) {
				items?.add(`${type}:${id}`)
			}
		})
	},
	[context_, sideEffect, id],
)

export const trackEach = EXPORTABLE(
	(context, sideEffect, applyTransforms, each, object, id) =>
		($documents: DocumentsStep) => {
			const $items = context().get("items")
			const $info = applyTransforms(
				each($documents, ($document) =>
					object({
						type: $document.get("type"),
						id: id($document),
					}),
				),
			)

			sideEffect([$items, $info], ([items, info]) => {
				for (const { type, id } of info) {
					items?.add(`${type}:${id}`)
				}
			})
		},
	[context_, sideEffect, applyTransforms, each, object, id],
)

export const trackList = EXPORTABLE(
	(sideEffect, context) => (type: string) => {
		const $items = context().get("items")
		sideEffect([$items], ([items]) => {
			if (items) {
				items.add(type)
			}
		})
	},
	[sideEffect, context_],
)
