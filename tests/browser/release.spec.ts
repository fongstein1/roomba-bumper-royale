import { test, expect, type Page } from '@playwright/test';

async function position(page: Page, player: string) {
  return page.getByTestId(`radar-${player}`).evaluate((element) => ({ x: Number(element.getAttribute('data-x')), z: Number(element.getAttribute('data-z')) }));
}
async function assertResults(page: Page) {
  await expect(page.getByRole('dialog', { name: 'Match results' })).toBeVisible({ timeout: 110000 });
  const rows = await page.getByTestId('result-row').evaluateAll((elements) => elements.map((element) => ({
    coverage: Number(element.getAttribute('data-coverage')), dust: Number(element.getAttribute('data-dust')),
    bumps: Number(element.getAttribute('data-bumps')), score: Number(element.getAttribute('data-score')),
  })));
  expect(rows).toHaveLength(4);
  // Independent oracle: do not import the game's score helper into browser checks.
  rows.forEach((row) => expect(row.score).toBeCloseTo(row.coverage * 10 + row.dust + row.bumps * 25, 5));
  expect(rows.map((row) => row.score)).toEqual(rows.map((row) => row.score).sort((a, b) => b - a));
  expect(rows.some((row) => row.score > 0)).toBe(true);
}
async function visibleControls(page: Page) {
  for (const button of await page.getByRole('button', { name: /^Player / }).all()) {
    await expect(button).toBeInViewport();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    const hittable = await button.evaluate((element) => {
      const r = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(hittable).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('solo: keyboard, scoring, pause/resume, full round, rematch and quit', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Solo vs Bots' }).click();
  await expect(page.getByRole('timer')).toHaveText(/^01:(30|2\d)$/);
  const initial = await position(page, 'p1');
  await page.keyboard.down('w'); await page.waitForTimeout(1200); await page.keyboard.up('w');
  const moved = await position(page, 'p1');
  expect(Math.hypot(moved.x - initial.x, moved.z - initial.z)).toBeGreaterThan(1);
  await page.screenshot({ path: info.outputPath('solo.png') });
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Game paused' })).toBeVisible();
    const pausedTime = await page.getByRole('timer').textContent();
    if (i === 0) await page.waitForTimeout(1500);
    expect(await page.getByRole('timer').textContent()).toBe(pausedTime);
    await page.getByRole('button', { name: 'Resume Cleaning' }).click();
  }
  // Also exercise the visible pause and sound buttons.
  await page.getByRole('button', { name: 'Mute Sound', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unmute Sound', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pause Game' }).click();
  await page.getByRole('button', { name: 'Resume Cleaning' }).click();
  await assertResults(page);
  await page.screenshot({ path: info.outputPath('solo-results.png') });
  await page.getByRole('button', { name: 'Rematch', exact: true }).click();
  await expect(page.getByRole('timer')).toHaveText(/^01:(30|2\d)$/);
  await expect(page.getByText(/^[1-4] High Value$/)).toBeVisible();
  await page.getByRole('button', { name: 'Pause Game' }).click();
  await page.getByRole('button', { name: 'Restart Round' }).click();
  await expect(page.getByRole('timer')).toHaveText(/^01:(30|2\d)$/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Exit to Main Menu' }).click();
  await expect(page.getByRole('button', { name: 'Solo vs Bots' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('local multiplayer: independent keyboard controls and a complete match', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '2-Player Split-Screen' }).click();
  const p1Start = await position(page, 'p1'); const p2Start = await position(page, 'p2');
  await page.keyboard.down('w'); await page.keyboard.down('ArrowUp');
  await page.keyboard.down('Space'); await page.keyboard.down('Enter');
  await page.waitForTimeout(1400);
  await page.keyboard.up('w'); await page.keyboard.up('ArrowUp');
  await page.keyboard.up('Space'); await page.keyboard.up('Enter');
  const p1End = await position(page, 'p1'); const p2End = await position(page, 'p2');
  expect(Math.hypot(p1End.x - p1Start.x, p1End.z - p1Start.z)).toBeGreaterThan(1);
  expect(Math.hypot(p2End.x - p2Start.x, p2End.z - p2Start.z)).toBeGreaterThan(1);
  await page.screenshot({ path: info.outputPath('multiplayer.png') });
  await assertResults(page);
  expect(errors).toEqual([]);
});

test.describe('phone touch and menus', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  test('portrait and landscape: garage scrolling, multitouch, pointer release and pause', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.getByRole('button', { name: /Customizer Garage/ }).click();
    await page.getByRole('textbox', { name: 'Vacuum device name' }).fill('Friends');
    await page.getByRole('button', { name: 'Viking Horns' }).click();
    await expect(page.getByRole('button', { name: 'Viking Horns' })).toBeInViewport();
    await page.screenshot({ path: info.outputPath('phone-garage.png') });
    await page.getByRole('button', { name: 'Back to Menu' }).click();
    await page.getByRole('button', { name: 'Solo vs Bots' }).click();
    await visibleControls(page);
    const initial = await position(page, 'p1');
    const cdp = await page.context().newCDPSession(page);
    const forward = (await page.getByRole('button', { name: 'Player 1 Forward', exact: true }).boundingBox())!;
    const boost = (await page.getByRole('button', { name: 'Player 1 Turbo Boost', exact: true }).boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { x: forward.x + forward.width / 2, y: forward.y + forward.height / 2, id: 1 },
      { x: boost.x + boost.width / 2, y: boost.y + boost.height / 2, id: 2 },
    ] });
    await page.waitForTimeout(1200);
    await expect.poll(async () => Number(await page.getByTestId('radar-p1').getAttribute('data-boost'))).toBeLessThan(99);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByTestId('radar-p1')).toHaveAttribute('data-boosting', 'false');
    const moved = await position(page, 'p1');
    expect(Math.hypot(moved.x - initial.x, moved.z - initial.z)).toBeGreaterThan(1);
    await page.screenshot({ path: info.outputPath('phone-solo.png') });
    await page.getByRole('button', { name: 'Pause Game' }).tap();
    const paused = await page.getByRole('timer').textContent();
    await page.waitForTimeout(500);
    expect(await page.getByRole('timer').textContent()).toBe(paused);
    await page.getByRole('button', { name: 'Exit to Main Menu' }).tap();
    await page.getByRole('button', { name: '2-Player Split-Screen' }).tap();
    await visibleControls(page);
    await page.screenshot({ path: info.outputPath('phone-split.png') });
    await page.setViewportSize({ width: 844, height: 390 });
    await visibleControls(page);
    await page.screenshot({ path: info.outputPath('phone-landscape.png') });
    // Releasing a pointer by cancellation and leaving the app must clear input.
    const cancelButton = (await page.getByRole('button', { name: 'Player 1 Forward', exact: true }).boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cancelButton.x + cancelButton.width / 2, y: cancelButton.y + cancelButton.height / 2, id: 3 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.getByRole('dialog', { name: 'Game paused' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume Cleaning' }).tap();
    await expect(page.getByRole('dialog', { name: 'Game paused' })).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test('unsupported graphics shows an actionable message', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (type === 'webgl2') return null;
      return getContext.apply(this, [type, ...args] as any);
    } as typeof getContext;
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('The 3D arena couldn’t start');
  await expect(page.getByRole('button', { name: 'Reload game' })).toBeVisible();
});
