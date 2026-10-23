/** Height of the sticky heading row (`thead`) inside a table scroll viewport, or zero when it has none. */
function headingHeight(viewport: HTMLElement): number {
  return viewport.querySelector('thead')?.getBoundingClientRect().height ?? 0;
}

/**
 * Scroll only the given viewport so the target row or cell is centered below its sticky table heading.
 * Native clamping pins the first and last pages; horizontal position, other panes, and keyboard focus are untouched.
 */
export function centerBelowHeading(viewport: HTMLElement, target: HTMLElement): void {
  const header = headingHeight(viewport);
  const bounds = target.getBoundingClientRect();
  viewport.scrollTop +=
    bounds.top -
    viewport.getBoundingClientRect().top -
    viewport.clientTop -
    header -
    (viewport.clientHeight - header - bounds.height) / 2;
}

/** Whether the target's bottom edge is within the viewport's visible height, measured from the viewport's top border edge. */
export function endsWithinViewport(viewport: HTMLElement, target: HTMLElement): boolean {
  const viewportTop = viewport.getBoundingClientRect().top + viewport.clientTop;
  return target.getBoundingClientRect().bottom <= viewportTop + viewport.clientHeight;
}
