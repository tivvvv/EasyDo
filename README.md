# EasyDo

EasyDo 是一个 local-first 的任务管理和日历应用. 第一阶段以 Web 端为主, 后续可演进到移动端和桌面端.

当前仓库仅包含 React + TypeScript + Vite + pnpm workspace 的基础工程结构, 尚未加入业务功能.

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

更多规范请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md).
