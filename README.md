# EasyDo

EasyDo 是一个 local-first 的任务管理和日历应用. 第一阶段以 Web 端为主, 后续可演进到移动端和桌面端.

当前版本为 EasyDo 1.0.0. 应用完全在浏览器本地运行, 不需要账号或网络服务.

## 1.0 功能

- 月, 周, 日三种日历视图, 按时间展示每天任务.
- 日历右侧当天安排与完成进度, 月视图支持拖动任务改期.
- 新建, 编辑, 完成, 恢复和删除任务.
- 日期, 时间, 预计时长, 备注和四级优先级.
- 自定义分类与标签, 支持按分类和标签查看任务.
- 今天, 收集箱和全部任务智能视图.
- 标题与备注搜索, 优先级筛选和常用键盘快捷键.
- IndexedDB 本地持久化, 数据不会上传到网络.
- 桌面和手机自适应界面.

## 目录结构

```text
apps/web/              Web 应用入口.
packages/domain/       领域模型与业务规则.
packages/application/  应用服务与用例编排.
packages/storage/      存储抽象与平台适配.
scripts/               仓库维护脚本.
```

## 开始开发

```bash
pnpm install
pnpm dev
```

打开终端显示的本地地址即可使用. 按 `N` 可快速新建任务, 按 `Command + K` 或 `Ctrl + K` 可聚焦搜索框.

## 质量检查

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm build
```

更多规范请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md).
