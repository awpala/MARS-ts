## createSubscriber

<blockquote class="since note">

Available in supporting Svelte 5 releases. Verify the repository's exact package pin against first-party documentation.

</blockquote>

Returns a `subscribe` function that integrates external event-based systems with Svelte's reactivity. It's particularly useful for integrating with web APIs like `MediaQuery`, `IntersectionObserver`, or `WebSocket`.

If `subscribe` is called inside an effect (including indirectly, for example inside a getter), the `start` callback will be called with an `update` function. Whenever `update` is called, the effect re-runs.

If `start` returns a cleanup function, it will be called when the effect is destroyed.

If `subscribe` is called in multiple effects, `start` will only be called once as long as the effects are active, and the returned teardown function will only be called when all effects are destroyed.

The following browser-only sketch illustrates subscription ownership; it is not the built-in implementation of [`MediaQuery`](https://svelte.dev/docs/svelte/svelte-reactivity#MediaQuery):

In application code, import `MediaQuery` from `svelte/reactivity` with an explicit SSR fallback instead of copying this sketch.

```js
import { createSubscriber } from 'svelte/reactivity';
import { on } from 'svelte/events';

/** Browser-only media-query sketch; listeners live while reactive readers exist. */
export class BrowserMediaQuery {
	#query;
	#subscribe;

	/** Construct in a browser-owned lifecycle, never during SSR. */
	constructor(query) {
		this.#query = window.matchMedia(`(${query})`);

		this.#subscribe = createSubscriber((update) => {
			// when the `change` event occurs, re-run any effects that read `this.current`
			const off = on(this.#query, 'change', update);

			// stop listening when all the effects are destroyed
			return () => off();
		});
	}

	/** Read the match and subscribe the active reactive reader. */
	get current() {
		// This makes the getter reactive, if read in an effect
		this.#subscribe();

		// Return the current state of the query, whether or not we're in an effect
		return this.#query.matches;
	}
}
```

<div class="ts-block">

```dts
function createSubscriber(
	start: (update: () => void) => (() => void) | void
): () => void;
```

</div>
