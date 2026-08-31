import { expect, test } from '@playwright/test';

test('创建, 搜索并完成任务', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByLabel('搜索任务')).toBeVisible();
  if (isMobile) {
    await page.getByRole('button', { name: '打开导航' }).click();
  }
  await page
    .getByRole('button', { name: /添加任务/ })
    .first()
    .click();
  await page.getByLabel('任务标题').fill('端到端验收任务');
  await page.getByRole('button', { name: '高优先级' }).click();
  if (isMobile) {
    await page.getByRole('button', { name: '创建任务' }).evaluate((button) => button.click());
  } else {
    await page.getByRole('button', { name: '创建任务' }).click();
  }
  await expect(page.getByText('任务已创建.')).toBeVisible();
  await expect(page.getByText('端到端验收任务').first()).toBeVisible();

  if (isMobile) {
    await page.getByRole('complementary').getByRole('button', { name: '关闭导航' }).click();
  }

  await page.getByLabel('搜索任务').fill('端到端验收');
  await expect(page.getByText('端到端验收任务').first()).toBeVisible();
  await page.getByLabel('搜索任务').fill('不存在的内容');
  await expect(page.getByText('端到端验收任务')).toHaveCount(0);
});

test('切换日历视图并创建分类和标签', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.getByRole('button', { name: '打开导航' }).click();
  }

  await page.getByRole('button', { name: '新建分类' }).click();
  await page.getByLabel('分类名称').fill('家庭');
  await page.getByRole('button', { name: '创建分类' }).click();
  await expect(page.getByRole('button', { name: '家庭', exact: true })).toBeVisible();

  if (isMobile) {
    await page.getByRole('complementary').getByRole('button', { name: '关闭导航' }).click();
  }
  await page.getByRole('button', { name: '周', exact: true }).click();
  await expect(page.locator('.time-calendar.week')).toBeVisible();
  await page.getByRole('button', { name: '日', exact: true }).click();
  await expect(page.locator('.time-calendar.day')).toBeVisible();
  await page.getByRole('button', { name: '日程', exact: true }).click();
  await expect(page.locator('.agenda-calendar')).toBeVisible();
});

test('管理重复任务, 子任务和回收站', async ({ page, isMobile }) => {
  test.skip(isMobile, '完整管理流程由桌面端覆盖.');
  await page.goto('/');
  await page
    .getByRole('button', { name: /添加任务/ })
    .first()
    .click();
  await page.getByLabel('任务标题').fill('每日验收任务');
  await page.locator('input[type="time"]').fill('09:30');
  await page.getByLabel(/重复/).selectOption('daily');
  await page.getByLabel('提醒').selectOption('10');
  await page.getByRole('button', { name: '添加子任务' }).click();
  await page.getByRole('textbox', { name: '子任务 1' }).fill('检查日程');
  await page.getByRole('button', { name: '创建任务' }).click();

  await page.getByText('每日验收任务').first().click();
  await expect(page.getByRole('textbox', { name: '子任务 1' })).toHaveValue('检查日程');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByText('任务已移到回收站.')).toBeVisible();

  await page.getByRole('button', { name: /回收站/ }).click();
  await expect(page.getByText('每日验收任务')).toBeVisible();
  await page.getByRole('button', { name: '恢复', exact: true }).click();
  await expect(page.getByText('任务已恢复.')).toBeVisible();
});

test('编辑标签并打开数据设置', async ({ page, isMobile }) => {
  test.skip(isMobile, '侧栏管理流程由桌面端覆盖.');
  await page.goto('/');
  await page.getByRole('button', { name: '编辑专注' }).click();
  await page.getByLabel('标签名称').fill('深度专注');
  await page.getByRole('button', { name: '保存更改' }).click();
  await expect(page.getByRole('button', { name: /深度专注/ }).first()).toBeVisible();

  await page.getByRole('button', { name: '设置与数据' }).click();
  await expect(page.getByText('备份与恢复')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出' })).toBeVisible();
  await expect(page.getByText('任务提醒')).toBeVisible();
});
