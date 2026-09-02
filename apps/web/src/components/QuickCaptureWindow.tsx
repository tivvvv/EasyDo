import { CheckCircle2, Command } from 'lucide-react';
import { useState } from 'react';

import { taskService } from '../application';
import { useWorkspaceData } from '../hooks/useWorkspaceData';
import { addTag } from '../sharedStorage';
import { QuickCapture } from './QuickCapture';

export function QuickCaptureWindow() {
  const data = useWorkspaceData();
  const [created, setCreated] = useState(false);

  if (!data) return <main className="capture-window loading">正在连接共享数据...</main>;

  return (
    <main className="capture-window">
      <header data-tauri-drag-region>
        <span>EasyDo 快速收集</span>
        <small>
          <Command size={12} /> Enter 保存
        </small>
      </header>
      <QuickCapture
        autoFocus
        categories={data.categories}
        onCreate={async (draft, newTagNames) => {
          const createdTags = await Promise.all(newTagNames.map((name) => addTag(name, '#7c6cf2')));
          await taskService.create({
            ...draft,
            tagIds: [...draft.tagIds, ...createdTags.map((tag) => tag.id)],
          });
          setCreated(true);
          window.setTimeout(() => setCreated(false), 1_500);
        }}
        tags={data.tags}
      />
      <footer className={created ? 'created' : ''}>
        <CheckCircle2 size={14} />
        {created ? '已保存到共享收集箱.' : '支持日期, 时间, @分类, #标签, !优先级和提醒.'}
      </footer>
    </main>
  );
}
