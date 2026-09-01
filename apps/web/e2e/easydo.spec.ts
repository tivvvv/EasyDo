import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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

test('使用任务行菜单编辑和复制任务', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('button', { name: /全部任务/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '全部任务' })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2, name: '全部任务' })).toHaveCount(0);

  const firstTask = page.locator('.task-row').first();
  await firstTask.locator('.task-row-menu > summary').click();
  await expect(firstTask.getByRole('menu')).toBeVisible();
  await firstTask.getByRole('menuitem', { name: '创建副本' }).click();
  await expect(page.getByText('任务副本已创建.')).toBeVisible();
  await expect(page.locator('.task-row')).toHaveCount(4);

  await firstTask.locator('.task-row-menu > summary').click();
  await firstTask.getByRole('menuitem', { name: '编辑任务' }).click();
  await expect(page.getByRole('dialog', { name: /编辑任务/ })).toBeVisible();
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
  await page.getByLabel('时间', { exact: true }).fill('09:30');
  await page.getByLabel(/重复/).selectOption('daily');
  await page.getByRole('combobox', { name: '提醒', exact: true }).selectOption('10');
  await page.getByRole('combobox', { name: '提醒', exact: true }).selectOption('30');
  await expect(page.getByLabel('已设置提醒')).toContainText('提前 10 分钟');
  await expect(page.getByLabel('已设置提醒')).toContainText('提前 30 分钟');
  await page.getByRole('button', { name: '添加子任务' }).click();
  await page.getByRole('textbox', { name: '子任务 1' }).fill('检查日程');
  await page.getByRole('button', { name: '创建任务' }).click();

  await page.getByText('每日验收任务').first().click();
  await page.getByRole('button', { name: '完整编辑' }).click();
  await expect(page.getByRole('textbox', { name: '子任务 1' })).toHaveValue('检查日程');
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('button', { name: '移到回收站', exact: true }).click();
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
  await expect(page.getByRole('button', { name: '导出', exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: /保存为智能清单/ }).click();
  await page.getByLabel('清单名称').fill('近期重点');
  await page.getByRole('button', { name: '保存', exact: true }).click();
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
  await page.getByRole('button', { name: /保存模板/ }).click();
  await page.getByLabel('模板名称').fill('每日模板');
  await page.getByRole('button', { name: '保存', exact: true }).click();
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

test('自然语言快速添加, 多日历和任务分组', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByLabel('快速添加任务').fill('今天下午3点 版本验收 #专注 !高 持续2小时 提前30分钟');
  await page.getByRole('button', { name: '添加', exact: true }).click();
  await expect(page.getByText('任务已快速添加.')).toBeVisible();
  await expect(page.getByText('版本验收').first()).toBeVisible();

  await page.getByRole('button', { name: '5 日', exact: true }).click();
  await expect(page.locator('.time-calendar.fiveDay')).toBeVisible();
  await page.getByRole('button', { name: '3 日', exact: true }).click();
  await expect(page.locator('.time-calendar.threeDay')).toBeVisible();

  if (isMobile) await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('button', { name: /全部任务/ }).click();
  await page.getByLabel('任务分组').selectOption('priority');
  await page.getByLabel('任务排序').selectOption('date');
  await expect(page.locator('.task-group-heading', { hasText: '高优先级' })).toBeVisible();
});

test('创建文件夹并归档分类', async ({ page, isMobile }) => {
  test.skip(isMobile, '文件夹管理流程由桌面端覆盖.');
  await page.goto('/');
  await page.getByRole('button', { name: '新建文件夹' }).click();
  await page.getByLabel('文件夹名称').fill('核心项目');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '核心项目', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑工作' }).click();
  await page.getByLabel('所属文件夹').selectOption({ label: '核心项目' });
  await page.getByRole('button', { name: '保存更改' }).click();
  await expect(
    page.locator('.folder-nav-group').getByRole('button', { name: /^工作/ }),
  ).toBeVisible();
});

test('在日历中框选时间段创建任务', async ({ page, isMobile }) => {
  test.skip(isMobile, '精确指针框选由桌面端覆盖.');
  await page.goto('/');
  await page.getByRole('button', { name: '日', exact: true }).click();
  const column = page.locator('.schedule-column').first();
  const box = await column.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 100);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + 156, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: '安排一件事' })).toBeVisible();
  await expect(page.getByLabel('预计时长')).toHaveValue('60');
});

test('使用年视图, 四周视图和计划收件箱', async ({ page, isMobile }) => {
  test.skip(isMobile, '进阶日历规划由桌面端覆盖.');
  await page.goto('/');
  await page.getByLabel('快速添加任务').fill('待安排验收任务');
  await page.getByRole('button', { name: '添加', exact: true }).click();
  await page.getByRole('button', { name: '年', exact: true }).click();
  await expect(page.locator('.year-calendar')).toBeVisible();
  await expect(page.locator('.year-month')).toHaveCount(12);
  await page.getByRole('button', { name: '4 周', exact: true }).click();
  await expect(page.locator('.multi-week-calendar')).toBeVisible();
  await expect(page.locator('.planning-tray')).toContainText('计划收件箱');
});

test('管理看板分区, 习惯和效率统计', async ({ page, isMobile }) => {
  test.skip(isMobile, '效率工作台完整流程由桌面端覆盖.');
  await page.goto('/');
  await page.getByRole('button', { name: '效率工作台' }).click();
  await expect(page.getByRole('heading', { name: '任务看板' })).toBeVisible();
  await page.getByRole('button', { name: '新建分区' }).click();
  await page.getByLabel('分区名称').fill('待评审');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.kanban-column', { hasText: '待评审' })).toBeVisible();
  await page.getByRole('button', { name: '在 未分区 新建任务' }).click();
  await expect(
    page.getByRole('dialog', { name: '安排一件事' }).getByRole('combobox', { name: '分类' }),
  ).toHaveValue('category-work');
  await page.getByRole('button', { name: '取消' }).click();

  await page.getByRole('button', { name: '时间线', exact: true }).click();
  await expect(page.getByRole('heading', { name: '任务时间线' })).toBeVisible();
  await page.getByLabel('时间线范围').selectOption('14');
  await expect(page.locator('.timeline-scale > span')).toHaveCount(14);

  await page.getByRole('button', { name: '四象限', exact: true }).click();
  await page.getByLabel('紧急范围').selectOption('7');
  await expect(page.locator('.matrix-grid article')).toHaveCount(4);

  await page.getByRole('button', { name: '专注', exact: true }).click();
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await page.waitForTimeout(1_100);
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await page.getByRole('button', { name: '专注', exact: true }).click();
  await expect(page.locator('.focus-clock > span')).not.toHaveText('25:00');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '重置', exact: true }).click();

  await page.getByRole('button', { name: '习惯', exact: true }).click();
  await page.getByLabel('新习惯名称').fill('每日阅读');
  await page.getByRole('button', { name: '新建习惯' }).click();
  await expect(page.getByText('每日阅读')).toBeVisible();
  await page.getByRole('button', { name: '设置习惯 每日阅读' }).click();
  await page.getByLabel('周期').selectOption('weekly');
  await page.getByLabel('目标次数').fill('3');
  await page
    .getByRole('button', { name: /未打卡/ })
    .last()
    .click();
  await expect(page.getByText('今天已经开始积累了.')).toBeVisible();

  await page.getByRole('button', { name: '统计', exact: true }).click();
  await expect(page.getByRole('heading', { name: '效率统计' })).toBeVisible();
});

test('在移动端访问完整效率工具导航', async ({ page, isMobile }) => {
  test.skip(!isMobile, '此场景专门覆盖移动端效率工具导航.');
  await page.goto('/');
  await page.getByRole('button', { name: '打开导航' }).click();
  await page.getByRole('button', { name: '效率工作台' }).click();
  await expect(page.getByRole('heading', { name: '任务看板' })).toBeVisible();
  await page.getByRole('button', { name: '时间线', exact: true }).click();
  await expect(page.getByRole('heading', { name: '任务时间线' })).toBeVisible();
  await page.getByRole('button', { name: '专注', exact: true }).click();
  await expect(page.getByRole('button', { name: '短休息' })).toBeVisible();
  await page.getByRole('button', { name: '习惯', exact: true }).click();
  await expect(page.getByLabel('新习惯名称')).toBeVisible();
});

test('核心页面没有严重可访问性问题', async ({ page, isMobile }) => {
  test.skip(isMobile, '桌面和移动共用语义结构, 桌面端执行完整扫描.');
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .disableRules(['color-contrast'])
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  expect(results.violations.filter((item) => item.impact === 'critical')).toEqual([]);
});
