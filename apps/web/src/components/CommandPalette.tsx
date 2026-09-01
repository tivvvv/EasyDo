import { ArrowRight, Command, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
    if (!normalized) return actions;
    return actions.filter((action) =>
      `${action.label} ${action.section} ${action.keywords ?? ''}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [actions, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const execute = (action: CommandAction | undefined) => {
    if (!action) return;
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
                setSelectedIndex((index) => Math.min(index + 1, filtered.length - 1));
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
