import { expect, test, type Page } from '@playwright/test';
import { openDesktop } from './openDesktop.js';

async function run(page: Page, program: string) {
  await openDesktop(page);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByRole('textbox', { name: /^Source / }).fill(program);
  await page.getByRole('button', { name: 'Assemble', exact: true }).click();
  await page.getByRole('button', { name: 'Go', exact: true }).click();
}
const request = (service: number) => `la $a0,prompt\nli $v0,${service}\nsyscall\n`;
const printStatus = 'move $a0,$a1\nli $v0,1\nsyscall\n';
const finish = 'li $v0,10\nsyscall\n';
const data = '.data\nprompt: .asciiz "Value: "\nbuffer: .space 8\n.text\n';

test('random and all dialog families execute in sequence without echoing dialog input', async ({
  page
}) => {
  await run(
    page,
    data +
      'li $a0,-7\nli $a1,0\nli $v0,40\nsyscall\nli $v0,41\nsyscall\nli $v0,1\nsyscall\n' +
      request(50) +
      'li $v0,1\nsyscall\n' +
      request(51) +
      printStatus +
      request(52) +
      'mov.s $f12,$f0\n' +
      request(57) +
      request(53) +
      'mov.d $f12,$f0\n' +
      request(58) +
      'la $a1,buffer\nli $a2,4\n' +
      request(54) +
      printStatus +
      'la $a1,buffer\n' +
      request(59) +
      'li $a1,2\n' +
      request(55) +
      'li $a1,-2147483648\n' +
      request(56) +
      finish
  );
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Select an Option');
  await expect(dialog.getByRole('button', { name: 'Yes', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'No', exact: true }).click();
  await expect(dialog).toHaveAccessibleName('Input');
  await expect(dialog.getByRole('textbox', { name: 'Dialog input' })).toBeFocused();
  await dialog.getByRole('textbox').fill(' 42 ');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await dialog.getByRole('textbox').fill('0x1.8p2');
  await dialog.getByRole('textbox').press('Enter');
  await expect(dialog).toHaveAccessibleName('Information');
  await expect(dialog).toContainText('Value: 6.0');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await dialog.getByRole('textbox').fill('-0.0');
  await dialog.getByRole('textbox').press('Enter');
  await expect(dialog).toContainText('Value: -0.0');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await dialog.getByRole('textbox').fill('abcdef');
  await dialog.getByRole('textbox').press('Enter');
  await expect(dialog).toContainText('Value: abc');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(dialog).toHaveAccessibleName('Warning');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(dialog).toContainText('Value: -2147483648');
  await dialog.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const output = page.getByRole('textbox', { name: 'Run I/O', exact: true });
  await expect(output).toHaveValue(/-11554845761-1-4\n-- program is finished running --/);
  await expect(output).not.toHaveValue(/user input|abcdef|0x1.8p2/);
});

for (const response of ['Yes', 'Cancel', 'Close dialog', 'Escape'])
  test(`confirmation ${response} returns its distinct result and resumes`, async ({ page }) => {
    await run(page, data + request(50) + 'li $v0,1\nsyscall\n' + finish);
    const dialog = page.getByRole('dialog', { name: 'Select an Option' });
    if (response === 'Escape') await dialog.press('Escape');
    else await dialog.getByRole('button', { name: response, exact: true }).click();
    const expected = response === 'Yes' ? 0 : response === 'Cancel' ? 2 : -1;
    await expect(page.getByRole('textbox', { name: 'Run I/O', exact: true })).toHaveValue(
      new RegExp(`^${expected}\\n-- program is finished running --`)
    );
  });

for (const service of [51, 52, 53, 54])
  test(`service ${service} distinguishes empty input, Cancel, and Stop`, async ({ page }) => {
    const setup = service === 54 ? 'la $a1,buffer\nli $a2,8\n' : '';
    await run(
      page,
      data +
        setup +
        request(service) +
        printStatus +
        setup +
        request(service) +
        printStatus +
        setup +
        request(service) +
        'li $a0,999\nli $v0,1\nsyscall\n' +
        finish
    );
    const dialog = page.getByRole('dialog', { name: 'Input', exact: true });
    await dialog.getByRole('button', { name: 'OK', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog.getByRole('textbox')).toBeFocused();
    await dialog.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Run I/O', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Run I/O', exact: true })).toHaveValue(/^-3-2/);
    await expect(page.getByRole('textbox', { name: 'Run I/O', exact: true })).not.toHaveValue(
      /999/
    );
  });

test('a random range failure dispatches to a loaded exception handler', async ({ page }) => {
  await run(
    page,
    '.text\nli $a0,0\nli $a1,1\nli $v0,40\nsyscall\nli $a1,0\nli $v0,42\nsyscall\nli $a0,73\nli $v0,1\nsyscall\n' +
      finish +
      '.ktext 0x80000180\nmfc0 $k0,$14\naddiu $k0,$k0,4\nmtc0 $k0,$14\neret\n'
  );
  await expect(page.getByRole('textbox', { name: 'Run I/O', exact: true })).toHaveValue(
    /^73\n-- program is finished running --/
  );
});

test('message dialogs display program text literally and dismiss without an input result', async ({
  page
}) => {
  await run(
    page,
    '.data\nprompt: .asciiz "<html><b>Literal message</b>"\n.text\nli $a1,4\n' +
      request(55) +
      finish
  );
  const dialog = page.getByRole('dialog', { name: 'Message', exact: true });
  await expect(dialog).toContainText('<html><b>Literal message</b>');
  await expect(dialog.locator('b')).toHaveCount(0);
  await dialog.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Run I/O', exact: true })).toHaveValue(
    /^\n-- program is finished running --/
  );
});
