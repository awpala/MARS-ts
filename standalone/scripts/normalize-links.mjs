/**
 * Resolve optional document links against the published repository rather than a local directory.
 * Fragments, downloads, inline resources, and explicit external destinations retain their meaning.
 * `files` maps public assets and Help article basenames to their repository equivalents.
 */
export function normalizeHref(href, files) {
  if (!href || href.startsWith('#') || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) {
    return href;
  }
  const url = new URL(href, 'https://standalone.invalid/');
  const path = decodeURIComponent(url.pathname.slice(1));
  const equivalent = files[path] ?? path;
  const encoded = equivalent.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/awpala/MARS-ts/blob/main/${encoded}${url.search}${url.hash}`;
}

/**
 * Install the final HTML's link postprocessor, including late-loaded Help content.
 * The observer and capture listener live for the document's lifetime; no network probes are made.
 * Blob download links and router/fragment links are deliberately left intact.
 */
export function installLinkNormalization(normalize, files) {
  function update(anchor) {
    if (anchor.hasAttribute('download')) return;
    const before = anchor.getAttribute('href');
    if (before === null) return;
    const after = normalize(before, files);
    if (before === after) return;
    anchor.setAttribute('href', after);
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }
  function scan(node) {
    if (!(node instanceof Element)) return;
    if (node.matches('a[href]')) update(node);
    node.querySelectorAll('a[href]').forEach(update);
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') scan(record.target);
      else record.addedNodes.forEach(scan);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['href']
  });
  // Normalize synchronous programmatic clicks before SvelteKit sees them too.
  document.addEventListener(
    'click',
    (event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (anchor) update(anchor);
    },
    true
  );
  scan(document.documentElement);
}
