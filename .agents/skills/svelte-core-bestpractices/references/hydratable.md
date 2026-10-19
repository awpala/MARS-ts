This is an opt-in Svelte 5 API reference. The installed compiler exposes `hydratable`, but the application has not enabled async components. The examples use synthetic values and do not introduce direct database access from the UI. Prefer existing SvelteKit server loads and server-only modules for application data.

In Svelte, when you want to render asynchronous content data on the server, you can simply `await` it. This is great! However, it comes with a pitfall: when hydrating that content on the client, Svelte has to redo the asynchronous work, which blocks hydration for however long it takes:

```svelte
<script>
	const getUser = async () => ({ name: 'Example member' });

	// This will get the user on the server, render the user's name into the h1,
	// and then, during hydration on the client, it will get the user _again_,
	// blocking hydration until it's done.
	const user = await getUser();
</script>

<h1>{user.name}</h1>
```

That's silly, though. If we've already done the hard work of getting the data on the server, we don't want to get it again during hydration on the client. `hydratable` is a low-level API built to solve this problem. You probably won't need this very often — it will be used behind the scenes by whatever datafetching library you use. For example, it powers [remote functions in SvelteKit](https://svelte.dev/docs/kit/remote-functions).

To fix the example above:

```svelte
<script>
	import { hydratable } from 'svelte';
	const getUser = async () => ({ name: 'Example member' });

	// During server rendering, this will serialize and stash the result of `getUser`, associating
	// it with the provided key and baking it into the `head` content. During hydration, it will
	// look for the serialized version, returning it instead of running `getUser`. After hydration
	// is done, if it's called again, it'll simply invoke `getUser`.
	const user = await hydratable('user', () => getUser());
</script>

<h1>{user.name}</h1>
```

This API can also be used to provide access to random or time-based values that are stable between server rendering and hydration. For example, to get a random number that doesn't update on hydration:

```ts
import { hydratable } from 'svelte';
const rand = hydratable('random', () => Math.random());
```

If you're a library author, be sure to prefix the keys of your `hydratable` values with the name of your library so that your keys don't conflict with other libraries.

## Serialization

All data returned from a `hydratable` function must be serializable. But this doesn't mean you're limited to JSON — Svelte uses [`devalue`](https://github.com/sveltejs/devalue), which can serialize all sorts of things including `Map`, `Set`, `URL`, and `BigInt`. Check the documentation page for a full list. In addition to these, thanks to some Svelte magic, you can also fearlessly use promises:

```svelte
<script>
	import { hydratable } from 'svelte';
	const promises = hydratable('random', () => {
		return {
			one: Promise.resolve(1),
			two: Promise.resolve(2),
		};
	});
</script>

{await promises.one}
{await promises.two}
```

## CSP

`hydratable` adds an inline `<script>` block to the `head` returned from `render`. If you're using [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) (CSP), this script will likely fail to run. You can provide a `nonce` to `render`:

```js
const nonce = crypto.randomUUID();

const { head, body } = await render(App, {
	csp: { nonce },
});
```

This will add the `nonce` to the script block, on the assumption that you will later add the same nonce to the CSP header of the document that contains it:

```js
response.headers.set('Content-Security-Policy', `script-src 'nonce-${nonce}'`);
```

Generate a fresh nonce for each dynamically rendered response, and use that same value in its script attributes and CSP header.

If instead you are generating static HTML ahead of time, you must use hashes instead:

```js
const { head, body, hashes } = await render(App, {
	csp: { hash: true },
});
```

`hashes.script` will be an array of strings like `["sha256-abcd123"]`. As with `nonce`, the hashes should be used in your CSP header:

```js
response.headers.set(
	'Content-Security-Policy',
	`script-src ${hashes.script.map((hash) => `'${hash}'`).join(' ')}`,
);
```

For dynamic responses, prefer a per-response nonce. For static output, use the hashes returned for that output; do not reuse a nonce as a static site-wide value.
