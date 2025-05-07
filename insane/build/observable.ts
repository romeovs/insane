import {
	type Observable,
	type ObservableInput,
	type ObservedValueOf,
	type OperatorFunction,
	distinctUntilChanged as distinctUntilChanged_,
	map as map_,
	of,
	switchMap as switchMap_,
} from "rxjs"

export { Observable } from "rxjs"

export function mapValue<T, R>(
	fn: (value: T, index: number) => R,
): OperatorFunction<T | Error, R | Error> {
	return map_((value: T | Error, index: number) => {
		if (value instanceof Error) {
			return value as Error
		}
		return fn(value, index)
	})
}

export function switchAll<
	O extends ObservableInput<unknown> | Error,
>(): OperatorFunction<O, ObservedValueOf<O> | Error> {
	return switchMap_((value): Observable<ObservedValueOf<O> | Error> => {
		if (value instanceof Error) {
			return of(value) as Observable<Error>
		}
		return value as Observable<ObservedValueOf<O>>
	})
}

export function distinctUntilChanged<T>(compare: (a: T, b: T) => boolean) {
	return distinctUntilChanged_<T | Error>(
		(a, b) => !(a instanceof Error || b instanceof Error) && compare(a, b),
	)
}
