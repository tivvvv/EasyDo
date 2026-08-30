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
  await page.getByRole('button', { name: '创建任务' }).click();
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
  await expect(page.getByRole('button', { name: /家庭/ })).toBeVisible();

  if (isMobile) {
    await page.getByRole('complementary').getByRole('button', { name: '关闭导航' }).click();
  }
  await page.getByRole('button', { name: '周', exact: true }).click();
  await expect(page.locator('.time-calendar.week')).toBeVisible();
  await page.getByRole('button', { name: '日', exact: true }).click();
  await expect(page.locator('.time-calendar.day')).toBeVisible();
});
