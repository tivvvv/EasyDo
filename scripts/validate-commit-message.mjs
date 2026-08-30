import { readFileSync } from 'node:fs';

const messageFile = process.argv[2];

if (!messageFile) {
  console.error('缺少 commit message 文件路径.');
  process.exit(1);
}

const message = readFileSync(messageFile, 'utf8').split(/\r?\n/, 1)[0]?.trim() ?? '';
const allowedTypes = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];
const chinesePunctuation =
  /[\uFF0C\u3002\uFF01\uFF1F\uFF1B\uFF1A\u3001\u201C\u201D\u2018\u2019\uFF08\uFF09\u3010\u3011\u300A\u300B\u2026]/u;
const format = new RegExp(`^(${allowedTypes.join('|')}): (?=.*[\\u3400-\\u9fff]).+\\.$`, 'u');

if (!format.test(message) || chinesePunctuation.test(message)) {
  console.error('Commit message 不符合规范.');
  console.error('请使用 type: 简洁中文说明. 格式, 使用英文标点符号, 并以英文句号结尾.');
  process.exit(1);
}
