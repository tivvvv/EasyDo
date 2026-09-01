import { spawn } from 'node:child_process';

const children = new Set();
let stopping = false;

function run(command, args) {
  const child = spawn(command, args, { stdio: 'inherit' });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}

const dataService = run('cargo', [
  'run',
  '--manifest-path',
  'apps/desktop/src-tauri/Cargo.toml',
  '--features',
  'data-service-bin',
  '--bin',
  'easydo-data-service',
]);
const web = run('pnpm', ['--filter', '@easydo/web', 'dev']);

dataService.once('exit', async (code) => {
  if (stopping || code === 0) return;
  try {
    const response = await fetch('http://127.0.0.1:24873/api/v1/health');
    if (response.ok) return;
  } catch {
    // 后续统一输出服务不可用状态并关闭开发进程.
  }
  stop(code ?? 1);
});
web.once('exit', (code) => stop(code ?? 0));

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
