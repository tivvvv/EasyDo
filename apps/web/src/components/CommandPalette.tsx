import { ArrowRight, Command, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { scoreCommand } from '../lib/commandSearch';

const recentCommandKey = 'easydo-recent-commands';

export type CommandAction = {
  id: string;
  keywords?: string;
  label: string;
  run: () => void;
  section: string;
  shortcut?: string;
};

export function CommandPalette({
  actions,
  onClose,
}: {
  actions: CommandAction[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const recentIds = loadRecentCommandIds();
    if (!normalized) {
      return [...actions].sort((left, right) => {
        const leftIndex = recentIds.indexOf(left.id);
        const rightIndex = recentIds.indexOf(right.id);
        if (leftIndex < 0 && rightIndex < 0) return 0;
        if (leftIndex < 0) return 1;
        if (rightIndex < 0) return -1;
        return leftIndex - rightIndex;
      });
    }
    return actions
      .map((action) => ({
        action,
        score: scoreCommand(
          `${action.label} ${action.section} ${action.keywords ?? ''}`.toLocaleLowerCase(),
          normalized,
        ),
      }))
      .filter((result) => result.score >= 0)
      .sort((left, right) => right.score - left.score)
      .map((result) => result.action);
  }, [actions, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const execute = (action: CommandAction | undefined) => {
    if (!action) return;
    persistRecentCommand(action.id);
    onClose();
    action.run();
  };

  return (
    <div
      className="command-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section aria-label="全局命令" aria-modal="true" className="command-palette" role="dialog">
        <header>
          <Search size={18} />
          <input
            aria-label="搜索命令"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
              else if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSelectedIndex((index) => Math.max(0, Math.min(index + 1, filtered.length - 1)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSelectedIndex((index) => Math.max(0, index - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                execute(filtered[selectedIndex]);
              }
            }}
            placeholder="输入任务, 视图或设置名称"
            ref={inputRef}
            value={query}
          />
          <button aria-label="关闭命令面板" onClick={onClose} type="button">
            <X size={17} />
          </button>
        </header>
        <div className="command-results" role="listbox">
          {filtered.length ? (
            filtered.map((action, index) => {
              const firstInSection = index === 0 || filtered[index - 1]?.section !== action.section;
              return (
                <div className="command-result-group" key={action.id}>
                  {firstInSection && <p>{action.section}</p>}
                  <button
                    aria-selected={index === selectedIndex}
                    className={index === selectedIndex ? 'selected' : ''}
                    onClick={() => execute(action)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    role="option"
                    type="button"
                  >
                    <span>
                      <Command size={15} />
                      {action.label}
                    </span>
                    {action.shortcut ? <kbd>{action.shortcut}</kbd> : <ArrowRight size={15} />}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="command-empty">
              <Search size={24} />
              <strong>没有匹配的命令</strong>
              <span>尝试输入“日历”或“新建”.</span>
            </div>
          )}
        </div>
        <footer>
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </footer>
      </section>
    </div>
  );
}

function loadRecentCommandIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(recentCommandKey) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

function persistRecentCommand(id: string): void {
  try {
    const recent = loadRecentCommandIds().filter((item) => item !== id);
    localStorage.setItem(recentCommandKey, JSON.stringify([id, ...recent].slice(0, 6)));
  } catch {
    // 隐私模式或受限 WebView 禁用存储时, 命令本身仍应正常执行.
  }
}
