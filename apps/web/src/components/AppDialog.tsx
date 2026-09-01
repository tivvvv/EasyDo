import { AlertTriangle, X } from 'lucide-react';
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type DialogOptions = {
  cancelText?: string;
  confirmText?: string;
  danger?: boolean;
  description?: string;
  initialValue?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  title: string;
};

type DialogRequest = DialogOptions & {
  kind: 'confirm' | 'prompt';
};

type AppDialogApi = {
  confirm: (options: DialogOptions) => Promise<boolean>;
  prompt: (options: DialogOptions) => Promise<string | null>;
};

const fallbackApi: AppDialogApi = {
  confirm: async () => false,
  prompt: async () => null,
};

const AppDialogContext = createContext<AppDialogApi>(fallbackApi);

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  const resolver = useRef<((result: boolean | string | null) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback((next: DialogRequest) => {
    resolver.current?.(next.kind === 'confirm' ? false : null);
    setValue(next.initialValue ?? '');
    setRequest(next);
    return new Promise<boolean | string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean | string | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setRequest(null);
  }, []);

  useEffect(() => {
    if (!request) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(request.kind === 'confirm' ? false : null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, request]);

  const api: AppDialogApi = {
    confirm: async (options) => Boolean(await open({ ...options, kind: 'confirm' })),
    prompt: async (options) => {
      const result = await open({ ...options, kind: 'prompt' });
      return typeof result === 'string' ? result : null;
    },
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!request) return;
    if (request.kind === 'prompt') {
      const normalized = value.trim();
      if (request.required !== false && !normalized) {
        inputRef.current?.focus();
        return;
      }
      close(normalized);
      return;
    }
    close(true);
  };

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      {request && (
        <div
          className="dialog-backdrop app-dialog-backdrop"
          onMouseDown={() => close(request.kind === 'confirm' ? false : null)}
        >
          <form
            aria-describedby={request.description ? 'app-dialog-description' : undefined}
            aria-modal="true"
            className="app-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
            role="dialog"
          >
            <header>
              <span className={request.danger ? 'app-dialog-icon danger' : 'app-dialog-icon'}>
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2>{request.title}</h2>
                {request.description && <p id="app-dialog-description">{request.description}</p>}
              </div>
              <button
                aria-label="关闭"
                className="icon-button"
                onClick={() => close(request.kind === 'confirm' ? false : null)}
                type="button"
              >
                <X size={18} />
              </button>
            </header>
            {request.kind === 'prompt' && (
              <label className="app-dialog-field">
                <span>{request.label ?? '名称'}</span>
                <input
                  placeholder={request.placeholder}
                  ref={inputRef}
                  required={request.required !== false}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </label>
            )}
            <footer>
              <button
                className="secondary-button"
                onClick={() => close(request.kind === 'confirm' ? false : null)}
                type="button"
              >
                {request.cancelText ?? '取消'}
              </button>
              <button
                className={request.danger ? 'primary-button danger-button' : 'primary-button'}
                type="submit"
              >
                {request.confirmText ?? (request.kind === 'confirm' ? '确认' : '保存')}
              </button>
            </footer>
          </form>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppDialog() {
  return useContext(AppDialogContext);
}
