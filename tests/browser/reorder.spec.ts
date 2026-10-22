import { expect, test } from '@playwright/test';
import { openDesktop, openStoredSources, waitForDesktop } from './openDesktop.js';

test('dragging source tabs preserves selection, dirty contents, loaded execution, and restored order', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(
    page,
    ['a.asm', 'b.asm', 'c.asm'].map((name) => ({ name, source: '.text\nnop\n' }))
  );
  const action = (name: string) => page.getByRole('button', { name, exact: true });
  await action('b.asm').click();
  const source = page.getByRole('textbox', { name: 'Source b.asm', exact: true });
  await source.fill('.text\nli $t0, 9\n');
  await action('Assemble').click();
  await action('Edit').click();
  await action('c.asm').dragTo(action('a.asm'), { targetPosition: { x: 3, y: 10 } });
  await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', 'a.asm', '* b.asm']);
  await expect(action('* b.asm')).toHaveAttribute('aria-pressed', 'true');
  await expect(source).toHaveValue('.text\nli $t0, 9\n');
  await action('a.asm').dragTo(action('* b.asm'), { targetPosition: { x: 45, y: 10 } });
  await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', '* b.asm', 'a.asm']);
  await page.reload();
  await waitForDesktop(page);
  await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', '* b.asm', 'a.asm']);
  await expect(action('* b.asm')).toHaveAttribute('aria-pressed', 'true');
  await expect(source).toHaveValue('.text\nli $t0, 9\n');
  await action('Execute').click();
  await expect(page.locator('footer > span').first()).toHaveText('Loaded: b.asm');
  await expect(page.getByLabel('Execution status')).toHaveText('Status: assembled');
  await action('Edit').click();
  await action('a.asm').dragTo(source);
  await expect(source).toHaveValue('.text\nli $t0, 9\n');
  await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', '* b.asm', 'a.asm']);
  await action('a.asm').press('Alt+Shift+ArrowLeft');
  await expect(page.locator('.source-tabs .source-name')).toHaveText(['c.asm', 'a.asm', '* b.asm']);
});

test('source tab drop markers include the close control for intermediate and last tabs', async ({
  page
}) => {
  await openDesktop(page);
  await openStoredSources(
    page,
    ['a.asm', 'b.asm', 'c.asm'].map((name) => ({ name, source: '.text\nnop\n' }))
  );
  const dragged = page.getByRole('button', { name: 'a.asm', exact: true });
  for (const targetName of ['c.asm', 'b.asm']) {
    const target = page.getByRole('button', { name: targetName, exact: true });
    const close = page.getByRole('button', { name: `Close ${targetName}`, exact: true });
    const closeBox = await close.boundingBox();
    if (!closeBox) throw new Error('Expected a visible close control');
    const position = {
      clientX: closeBox.x + closeBox.width / 2,
      clientY: closeBox.y + closeBox.height / 2
    };
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await dragged.dispatchEvent('dragstart', { dataTransfer });
    await target.dispatchEvent('dragover', { dataTransfer, ...position });
    // Crossing from the filename to its close control must retain the insertion marker.
    await target.dispatchEvent('dragleave', {
      dataTransfer,
      relatedTarget: await close.elementHandle()
    });
    await close.dispatchEvent('dragover', { dataTransfer, ...position });
    const marker = page.locator('.source-tabs [data-drop-position]');
    await expect(marker).toHaveCount(1);
    const markerGeometry = await marker.evaluate((element) => ({
      right: element.getBoundingClientRect().right,
      markerRight: getComputedStyle(element, '::after').right,
      markerWidth: getComputedStyle(element, '::after').width
    }));
    expect(markerGeometry.right).toBeCloseTo(closeBox.x + closeBox.width, 0);
    await expect(marker).toHaveAttribute('data-drop-position', 'after');
    expect(markerGeometry.markerRight).toBe('0px');
    expect(markerGeometry.markerWidth).toBe('2px');
    await close.dispatchEvent('drop', { dataTransfer, ...position });
    await dragged.dispatchEvent('dragend', { dataTransfer });
    await dataTransfer.dispose();
    await expect(marker).toHaveCount(0);
    await expect(page.locator('.source-tabs .source-name')).toHaveText(
      targetName === 'c.asm' ? ['b.asm', 'c.asm', 'a.asm'] : ['b.asm', 'a.asm', 'c.asm']
    );
    await expect(close).toBeVisible();
  }
});
