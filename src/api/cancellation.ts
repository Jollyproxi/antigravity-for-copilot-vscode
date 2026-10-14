/** Stop this consumer's wait without cancelling shared authentication/project work. */
export function awaitWithSignal<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const abort = () => {
			signal?.removeEventListener('abort', abort);
			reject(signal?.reason ?? new DOMException('Request cancelled', 'AbortError'));
		};
		if (signal?.aborted) {
			abort();
			return;
		}
		signal?.addEventListener('abort', abort, { once: true });
		// Observe late rejection too: the underlying shared operation can outlive us.
		try {
			work().then(
				value => {
					signal?.removeEventListener('abort', abort);
					if (signal?.aborted) abort();
					else resolve(value);
				},
				error => {
					signal?.removeEventListener('abort', abort);
					reject(error);
				},
			);
		} catch (error) {
			signal?.removeEventListener('abort', abort);
			reject(error);
		}
	});
}
