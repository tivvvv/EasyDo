import type { BackupPayload } from '@easydo/domain';
import type { APIRequestContext } from '@playwright/test';

import { workspaceApi } from './environment';

const headers = { 'X-EasyDo-Client': '1' };

export async function resetWorkspace(
  request: Pick<APIRequestContext, 'get' | 'put'>,
  payload: BackupPayload,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await request.get(workspaceApi, { headers });
    if (!current.ok())
      throw new Error(`读取测试工作区失败: HTTP ${current.status()}, ${await current.text()}`);
    const revision = current.status() === 204 ? 0 : Number((await current.json()).revision);
    const response = await request.put(workspaceApi, {
      data: { baseRevision: revision, payload },
      headers,
    });
    // 上一页面已发出的保存请求可能晚于页面关闭完成, 仅重试明确的版本冲突.
    if (response.status() === 409) continue;
    if (!response.ok())
      throw new Error(`重置测试工作区失败: HTTP ${response.status()}, ${await response.text()}`);
    return;
  }
  throw new Error('重置测试工作区连续发生 5 次版本冲突.');
}
