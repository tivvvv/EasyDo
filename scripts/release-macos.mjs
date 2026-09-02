import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(join(repositoryRoot, path), 'utf8'));
const cargoManifest = readFileSync(
  join(repositoryRoot, 'apps/desktop/src-tauri/Cargo.toml'),
  'utf8',
);
const cargoVersion = cargoManifest.match(/^version = "([^"]+)"/m)?.[1];
const versions = new Map([
  ['根目录', readJson('package.json').version],
  ['网页端', readJson('apps/web/package.json').version],
  ['桌面端', readJson('apps/desktop/package.json').version],
  ['Tauri', readJson('apps/desktop/src-tauri/tauri.conf.json').version],
  ['Rust', cargoVersion],
]);
const uniqueVersions = new Set(versions.values());

if (uniqueVersions.size !== 1 || uniqueVersions.has(undefined)) {
  console.error('版本号不一致, 已停止发布.');
  for (const [label, version] of versions) console.error(`${label}: ${version ?? '缺失'}`);
  process.exit(1);
}

const version = [...uniqueVersions][0];
if (process.argv.includes('--check')) {
  console.log(`发布版本检查通过: ${version}.`);
  process.exit(0);
}

if (process.platform !== 'darwin') {
  console.error('macOS 安装包只能在 macOS 环境构建.');
  process.exit(1);
}

const targetRoot = join(repositoryRoot, 'apps/desktop/src-tauri/target');
const bundleDirectories = [
  join(targetRoot, 'release/bundle'),
  join(targetRoot, 'universal-apple-darwin/release/bundle'),
];
const releaseDirectory = join(repositoryRoot, 'release');

// 每次发布都从空目录开始, 避免旧架构和旧版本被误认为当前产物.
for (const directory of bundleDirectories) rmSync(directory, { force: true, recursive: true });
rmSync(releaseDirectory, { force: true, recursive: true });

const build = spawnSync('pnpm', ['--filter', '@easydo/desktop', 'build:universal'], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const sourceDirectory = join(targetRoot, 'universal-apple-darwin/release/bundle/dmg');
const images = readdirSync(sourceDirectory).filter((name) => name.endsWith('.dmg'));
if (images.length !== 1) {
  console.error(`预期生成一个 DMG, 实际找到 ${images.length} 个.`);
  process.exit(1);
}

mkdirSync(releaseDirectory, { recursive: true });
const destination = join(releaseDirectory, `EasyDo_${version}_macOS_universal.dmg`);
copyFileSync(join(sourceDirectory, images[0]), destination);

// Tauri 的中间产物只服务于打包, 正式目录始终只留下一个安装包.
for (const directory of bundleDirectories) rmSync(directory, { force: true, recursive: true });

const digest = createHash('sha256').update(readFileSync(destination)).digest('hex');
const megabytes = (statSync(destination).size / 1024 / 1024).toFixed(1);
console.log(`正式安装包: ${destination}`);
console.log(`大小: ${megabytes} MB.`);
console.log(`SHA-256: ${digest}`);
