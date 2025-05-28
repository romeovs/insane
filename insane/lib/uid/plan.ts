import {
	type AccessStep,
	type ExecutableStep,
	UnbatchedExecutableStep,
	context,
} from "grafast"

import type { UidEncoder } from "./encoder"

declare global {
	namespace Grafast {
		interface Context {
			encoding: UidEncoder
		}
	}
}

/**
 * Encode a uid as a string.
 *
 * Takes the $uid field from any table as a bigint (encoded as a string).
 * and returns a string.
 */
export function decode($uid: ExecutableStep) {
	const $encoding = context().get("encoding")
	return new DecodeUIDStep($encoding, $uid)
}

decode.$$export = {
	moduleName: "../../dist/runtime/index.mjs",
	exportName: "decode",
}

/**
 * Encode a uid as a string.
 */
export function encode($id: ExecutableStep<string>) {
	const $encoding = context().get("encoding")
	return new EncodeUIDStep($encoding, $id)
}

encode.$$export = {
	moduleName: "../../dist/runtime/index.mjs",
	exportName: "encode",
}

class EncodeUIDStep extends UnbatchedExecutableStep<string> {
	isSyncAndSafe = true

	constructor($encoding: AccessStep<UidEncoder>, $uid: ExecutableStep) {
		super()
		this.addDependency($encoding)
		this.addDependency($uid)
	}

	depuplicate(peers: EncodeUIDStep[]) {
		return peers.filter(
			(peer) =>
				peer.getDep(1) === this.getDep(1) && peer.getDep(2) === this.getDep(2),
		)
	}

	unbatchedExecute(_: unknown, encoding: UidEncoder, uid: string) {
		if (typeof uid !== "string") {
			return uid
		}
		return encoding.encode(uid)
	}
}

class DecodeUIDStep extends UnbatchedExecutableStep<string> {
	isSyncAndSafe = true

	constructor($encoder: AccessStep<UidEncoder>, $id: ExecutableStep) {
		super()
		this.addDependency($encoder)
		this.addDependency($id)
	}

	depuplicate(peers: DecodeUIDStep[]) {
		return peers.filter(
			(peer) =>
				peer.getDep(1) === this.getDep(1) && peer.getDep(2) === this.getDep(2),
		)
	}

	unbatchedExecute(_: unknown, encoding: UidEncoder, id: string): string {
		if (typeof id !== "string") {
			return id
		}
		return encoding.decode(id).toString()
	}
}
