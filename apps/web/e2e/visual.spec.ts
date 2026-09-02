import { expect, test } from '@playwright/test';

import { createInitialWorkspace } from '../src/lib/workspaceData';

const workspaceApi = 'http://127.0.0.1:24873/api/v1/workspace';
const clientHeaders = { 'X-EasyDo-Client': '1' };
const fixedNow = new Date('2026-09-03T09:00:00+08:00');

test.skip(process.platform !== 'darwin', '视觉基线使用 macOS 系统字体和渲染引擎.');

test.beforeEach(async ({ page, request }) => {
  await page.clock.setFixedTime(fixedNow);
  const current = await request.get(workspaceApi, { headers: clientHeaders });
  const revision =
    current.status() === 204
      ? 0
      : Number(((await current.json()) as { revision: number }).revision);
  const response = await request.put(workspaceApi, {
    data: { baseRevision: revision, payload: createInitialWorkspace(fixedNow) },
    headers: clientHeaders,
  });
  expect(response.ok()).toBe(true);
  await page.addInitScript(() => {
    localStorage.setItem('easydo-visual-test', 'true');
  });
});

test('日历主页视觉基线', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('搜索任务')).toBeVisible();
  await expect(page).toHaveScreenshot('calendar-home.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  });
});

test('深色任务详情视觉基线', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('button', { name: '设置与数据' }).click();
  await page.getByRole('button', { name: '深色', exact: true }).click();
  if (isMobile) await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('button', { name: /^今天/ }).click();
  await page.getByText('规划今天最重要的三件事').first().click();
  await expect(page.getByRole('dialog', { name: /编辑任务/ })).toBeVisible();
  await expect(page.locator('.toast')).toBeHidden();
  await expect(page).toHaveScreenshot('task-detail-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  });
});
