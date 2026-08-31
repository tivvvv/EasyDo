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
  await page.getByRole('button', { name: '完整编辑' }).click();
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

test('快速编辑, 跨天任务和智能清单', async ({ page, isMobile }) => {
  test.skip(isMobile, '高级日历流程由桌面端覆盖.');
  await page.goto('/');
  await page.getByText('规划今天最重要的三件事').first().click();
  await expect(page.getByRole('region', { name: /快速编辑/ })).toBeVisible();
  await page.getByLabel('快速编辑标题').fill('快速编辑后的任务');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('任务已快速更新.')).toBeVisible();

  await page
    .getByRole('button', { name: /添加任务/ })
    .first()
    .click();
  await page.getByLabel('任务标题').fill('跨天验收任务');
  const start = await page.getByLabel('日期', { exact: true }).inputValue();
  const end = new Date(`${start}T12:00:00`);
  end.setDate(end.getDate() + 1);
  await page.getByLabel('结束日期').fill(end.toISOString().slice(0, 10));
  await page.getByRole('button', { name: '创建任务' }).click();
  await expect(page.getByText('跨天验收任务').first()).toBeVisible();

  await page.getByRole('button', { name: '筛选' }).click();
  await page.getByLabel('日期范围').selectOption('next7');
  page.once('dialog', (dialog) => dialog.accept('近期重点'));
  await page.getByRole('button', { name: /保存为智能清单/ }).click();
  await expect(
    page.getByRole('complementary').getByRole('button', { exact: true, name: '近期重点' }),
  ).toBeVisible();
});

test('任务模板, 批量修改和撤销', async ({ page, isMobile }) => {
  test.skip(isMobile, '批量管理流程由桌面端覆盖.');
  await page.goto('/');
  await page
    .getByRole('button', { name: /添加任务/ })
    .first()
    .click();
  await page.getByLabel('任务标题').fill('模板验收任务');
  page.once('dialog', (dialog) => dialog.accept('每日模板'));
  await page.getByRole('button', { name: /保存模板/ }).click();
  await expect(page.getByText('任务模板已保存.')).toBeVisible();
  await page.getByRole('button', { name: '取消' }).click();
  await page
    .getByRole('button', { name: /添加任务/ })
    .first()
    .click();
  await page.getByLabel('从模板创建').selectOption({ label: '每日模板' });
  await expect(page.getByLabel('任务标题')).toHaveValue('模板验收任务');
  await page.getByRole('button', { name: '取消' }).click();

  await page.getByRole('button', { name: /全部任务/ }).click();
  const checkboxes = page.locator('.task-select');
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.getByLabel('批量修改优先级').selectOption('high');
  await page.getByRole('button', { name: '应用修改' }).click();
  await expect(page.getByText('批量修改已完成.')).toBeVisible();
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await expect(page.getByText('操作已撤销.')).toBeVisible();
});

test('保存日历显示偏好和查看操作记录', async ({ page, isMobile }) => {
  test.skip(isMobile, '设置管理流程由桌面端覆盖.');
  await page.goto('/');
  await page.getByRole('button', { name: '设置与数据' }).click();
  await page.getByLabel('日历密度').selectOption('compact');
  await page.getByLabel('日程范围').selectOption('7');
  await page.getByLabel('显示周末').click();
  await expect(page.getByLabel('显示周末')).not.toBeChecked();
  await expect(page.getByText('日历偏好已保存.')).toBeVisible();
  await page.getByRole('button', { name: '操作记录' }).click();
  await expect(page.getByRole('heading', { level: 2, name: '操作记录' })).toBeVisible();
});
