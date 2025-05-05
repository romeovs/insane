export async function* debounce<T>(gen: AsyncGenerator<T>, ms: number) {
	let lastValue: T | null = null

	let timeoutId: NodeJS.Timeout | null = null
	function debounce() {
		return new Promise((resolve) => {
			if (timeoutId !== null) {
				clearTimeout(timeoutId)
			}
			timeoutId = setTimeout(() => resolve(true), ms)
		})
	}

	for (;;) {
		const { value, done } = await gen.next()
		if (done) {
			if (timeoutId) {
				clearTimeout(timeoutId)
			}

			// Optionally yield the last value if debounce passed
			if (lastValue !== null) {
				yield lastValue
			}
			break
		}

		lastValue = value

		await debounce()

		// Only yield the most recent value if no new one arrives during debounce
		yield lastValue
		lastValue = null
	}
}
