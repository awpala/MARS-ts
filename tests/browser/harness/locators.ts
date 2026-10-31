import { expect, type Locator, type Page } from '@playwright/test';

/** Find the Text Segment row owning an address, independently of the displayed address base. */
export function instructionRow(page: Page, address: string): Locator {
  return page.getByTestId('text-row').filter({
    has: page.getByLabel(`Breakpoint ${address}`, { exact: true })
  });
}

/** Find the memory cell owning an input, including its selection, focus, and highlight surface. */
export function memoryCell(page: Page, address: string): Locator {
  return page.getByTestId('memory-cell').filter({
    has: page.getByLabel(`Memory ${address}`, { exact: true })
  });
}

/** Find a label row within its pane or owning rowgroup by its exact label button. */
export function labelRow(container: Locator, name: string): Locator {
  return container.getByTestId('label-row').filter({
    has: container.page().getByRole('button', { name, exact: true })
  });
}

/** Assert consecutive toolbar actions by their accessible names when their order is the contract. */
export async function expectButtonSequence(container: Locator, names: string[]): Promise<void> {
  await expect
    .poll(async () => {
      const buttons = await container
        .getByRole('button')
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
      return buttons.map((_, index) => buttons.slice(index, index + names.length));
    })
    .toContainEqual(names);
}
