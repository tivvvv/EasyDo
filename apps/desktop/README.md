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

## 正式发布

```bash
pnpm release:check
pnpm release:macos
```

发布脚本会校验根目录, Web, Desktop, Tauri 和 Rust 的版本号完全一致, 并在构建前后清理旧的 bundle 目录. 唯一正式产物位于 `release/EasyDo_<版本号>_macOS_universal.dmg`. Tauri 构建出的 `.app` 只是创建 DMG 所需的中间文件, 不再作为第二个用户产物保留.

桌面端和网页端统一通过本机数据服务访问同一份 SQLite 数据库. 服务仅监听 `127.0.0.1:24873`, 不会将任务或日程上传到互联网. 所有写入使用事务和版本校验, 数据变化会实时通知其他已打开界面. 关闭主窗口后服务继续运行, 系统托盘可重新打开客户端或在浏览器中打开完整网页界面.

从 1.9 升级时, WebView 和浏览器中的旧 IndexedDB 会先原样保存到 SQLite 的迁移备份表, 再与当前数据合并. 迁移完成后旧业务数据库会被安全清理. SQLite 同时保留最近 20 份历史数据用于恢复.

任务与习惯提醒由 macOS 原生调度, 关闭窗口后仍可触发. 应用还支持窗口恢复, 系统托盘, Dock 徽标, 全局快速添加和登录时启动.

本地构建使用 ad-hoc 签名. 对外分发前需要配置 Apple Developer 签名与公证凭据.
