import { expect, test } from '@playwright/test';

import { createInitialWorkspace } from '../src/lib/workspaceData';
import { workspaceApi } from './environment';

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

test('核心工作区视觉基线', async ({ page, isMobile }) => {
  test.skip(isMobile, '移动端关键页面已经由独立视觉基线覆盖.');
  await page.goto('/');

  await page.getByRole('button', { name: /全部任务/ }).click();
  await expect(page).toHaveScreenshot('task-list.png', visualOptions);

  await page.keyboard.press('Control+P');
  await expect(page.getByRole('dialog', { name: '全局命令' })).toBeVisible();
  await expect(page).toHaveScreenshot('command-palette.png', visualOptions);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: '日历', exact: true }).click();
  await page.getByRole('button', { name: '规划今天', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '今日计划' })).toBeVisible();
  await expect(page).toHaveScreenshot('daily-planner.png', visualOptions);
  await page.getByRole('button', { name: '关闭今日计划' }).click();

  await page.getByRole('button', { name: '设置与数据' }).click();
  await expect(page).toHaveScreenshot('settings.png', visualOptions);
});

test('效率工作台视觉基线', async ({ page, isMobile }) => {
  test.skip(isMobile, '移动端效率工作台由交互测试覆盖.');
  await page.goto('/');
  await page.getByRole('button', { name: '效率工作台' }).click();
  await expect(page.getByRole('heading', { name: '任务看板' })).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page).toHaveScreenshot('productivity-kanban.png', visualOptions);

  for (const [name, snapshot] of [
    ['时间线', 'productivity-timeline.png'],
    ['四象限', 'productivity-matrix.png'],
    ['专注', 'productivity-focus.png'],
    ['习惯', 'productivity-habits.png'],
    ['统计', 'productivity-statistics.png'],
  ] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page).toHaveScreenshot(snapshot, visualOptions);
  }
});

const visualOptions = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  maxDiffPixelRatio: 0.01,
};
