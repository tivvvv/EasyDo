# EasyDo Desktop

EasyDo Desktop 使用 Tauri 2 封装 `apps/web` 的同一套 React 界面. 桌面端不会复制前端源码, 因此任务, 日历, 主题和响应式体验与 Web 端保持一致.

当前同时支持 Apple Silicon 和 Intel Mac, 最低系统版本为 macOS 12.

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
pnpm desktop:build:universal
```

单架构产物位于 `apps/desktop/src-tauri/target/release/bundle/`. Universal 产物位于 `apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/`.

桌面端使用 WebView 的 IndexedDB 提供实时界面查询, 同时将完整数据写入 SQLite 当前快照和最近 10 份恢复历史. 任务与习惯提醒由 macOS 原生调度, 关闭应用后仍可触发. 应用还支持窗口恢复, 系统托盘, Dock 徽标, 全局快速添加和登录时启动.

本地构建使用 ad-hoc 签名. 对外分发前需要配置 Apple Developer 签名与公证凭据.
