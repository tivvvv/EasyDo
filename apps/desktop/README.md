# EasyDo Desktop

EasyDo Desktop 使用 Tauri 2 封装 `apps/web` 的同一套 React 界面. 桌面端不会复制前端源码, 因此任务, 日历, 主题和响应式体验与 Web 端保持一致.

当前优先支持 Apple Silicon Mac, 最低系统版本为 macOS 12.

## macOS 开发

```bash
pnpm desktop:dev
```

首次运行会编译 Rust 依赖. 后续开发只会增量构建变化内容.

## 质量检查

```bash
pnpm desktop:check
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
```

## 构建应用

```bash
pnpm desktop:build
```

构建完成后, `.app` 和 `.dmg` 位于 `apps/desktop/src-tauri/target/release/bundle/`.

桌面端使用 WebView 的持久化 IndexedDB 保存任务数据, 并通过 Tauri 原生通知插件发送系统提醒. 首次启用提醒时需要允许 macOS 通知权限. 应用窗口大小和位置会在本机自动恢复.
