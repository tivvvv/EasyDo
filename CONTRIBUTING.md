# 贡献指南

## 开发要求

项目使用 Node.js, pnpm workspace, React, TypeScript 和 Vite. 开发时遵循以下要求:

- 使用 TypeScript 严格模式, 避免无依据的类型断言和 `any`.
- 保持模块边界清晰, 领域逻辑不得依赖 React 或具体存储实现.
- 注释使用中文, 标点符号统一使用英文标点符号.
- 提交前确保格式检查, 静态检查, 类型检查和构建全部通过.
- 不提交依赖目录, 构建产物, 本地配置或敏感信息.

## 常用命令

```bash
pnpm install
pnpm dev
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

## Commit message 规范

Commit message 格式为 `type: 简洁中文说明.`. 描述必须包含中文, 使用英文标点符号, 并以英文句号结尾.

允许的类型如下:

- `feat`: 新功能或项目能力.
- `fix`: 缺陷修复.
- `docs`: 文档变更.
- `style`: 不影响逻辑的格式调整.
- `refactor`: 代码重构.
- `perf`: 性能优化.
- `test`: 测试变更.
- `build`: 构建系统或依赖变更.
- `ci`: 持续集成变更.
- `chore`: 其他维护工作.
- `revert`: 回退已有提交.

正确示例:

```text
feat: 初始化项目结构.
```
