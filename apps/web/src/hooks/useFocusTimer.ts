import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type FocusTimerMode = 'focus' | 'shortBreak' | 'stopwatch';

type TimerStatus = 'idle' | 'paused' | 'running';

type TimerState = {
  elapsedSeconds: number;
  mode: FocusTimerMode;
  segmentStartedAt: number | null;
  sessionStartedAt: number | null;
  status: TimerStatus;
  taskId: string;
};

type FocusTimerOptions = {
  focusMinutes: number;
  onComplete: (session: {
    durationMinutes: number;
    endedAt: string;
    startedAt: string;
    taskId: string | null;
  }) => Promise<void>;
  shortBreakMinutes: number;
};

const storageKey = 'easydo.focus-timer.v1';

const initialState: TimerState = {
  elapsedSeconds: 0,
  mode: 'focus',
  segmentStartedAt: null,
  sessionStartedAt: null,
  status: 'idle',
  taskId: '',
};

export function useFocusTimer(options: FocusTimerOptions) {
  const [state, setState] = useState<TimerState>(loadState);
  const [now, setNow] = useState(() => Date.now());
  const completingRef = useRef(false);
  const completeRef = useRef(options.onComplete);

  useEffect(() => {
    completeRef.current = options.onComplete;
  }, [options.onComplete]);

  const totalSeconds =
    state.mode === 'focus'
      ? options.focusMinutes * 60
      : state.mode === 'shortBreak'
        ? options.shortBreakMinutes * 60
        : 0;
  const elapsedSeconds = Math.max(
    0,
    state.elapsedSeconds +
      (state.status === 'running' && state.segmentStartedAt
        ? Math.floor((now - state.segmentStartedAt) / 1_000)
        : 0),
  );
  const remainingSeconds =
    state.mode === 'stopwatch' ? elapsedSeconds : Math.max(0, totalSeconds - elapsedSeconds);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (state.status !== 'running') return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [state.status]);

  useEffect(() => {
    if (
      state.mode !== 'focus' ||
      state.status !== 'running' ||
      remainingSeconds !== 0 ||
      !state.sessionStartedAt ||
      completingRef.current
    ) {
      return;
    }
    completingRef.current = true;
    const endedAt = new Date().toISOString();
    void completeRef
      .current({
        durationMinutes: options.focusMinutes,
        endedAt,
        startedAt: new Date(state.sessionStartedAt).toISOString(),
        taskId: state.taskId || null,
      })
      .finally(() => {
        setState((current) => ({
          ...current,
          elapsedSeconds: 0,
          segmentStartedAt: null,
          sessionStartedAt: null,
          status: 'idle',
        }));
        completingRef.current = false;
      });
  }, [options.focusMinutes, remainingSeconds, state]);

  const startOrPause = useCallback(() => {
    setNow(Date.now());
    setState((current) => {
      if (current.status === 'running') {
        return {
          ...current,
          elapsedSeconds:
            current.elapsedSeconds +
            (current.segmentStartedAt
              ? Math.floor((Date.now() - current.segmentStartedAt) / 1_000)
              : 0),
          segmentStartedAt: null,
          status: 'paused',
        };
      }
      const timestamp = Date.now();
      return {
        ...current,
        segmentStartedAt: timestamp,
        sessionStartedAt: current.sessionStartedAt ?? timestamp,
        status: 'running',
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState((current) => ({
      ...current,
      elapsedSeconds: 0,
      segmentStartedAt: null,
      sessionStartedAt: null,
      status: 'idle',
    }));
  }, []);

  const setMode = useCallback((mode: FocusTimerMode) => {
    setState((current) => ({ ...initialState, mode, taskId: current.taskId }));
  }, []);

  const setTaskId = useCallback((taskId: string) => {
    setState((current) => ({ ...current, taskId }));
  }, []);

  return useMemo(
    () => ({
      elapsedSeconds,
      mode: state.mode,
      remainingSeconds,
      reset,
      running: state.status === 'running',
      setMode,
      setTaskId,
      startOrPause,
      taskId: state.taskId,
    }),
    [elapsedSeconds, remainingSeconds, reset, setMode, setTaskId, startOrPause, state],
  );
}

function loadState(): TimerState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return initialState;
    const value = JSON.parse(raw) as Partial<TimerState>;
    if (
      !['focus', 'shortBreak', 'stopwatch'].includes(value.mode ?? '') ||
      !['idle', 'paused', 'running'].includes(value.status ?? '')
    ) {
      return initialState;
    }
    return {
      elapsedSeconds: Number.isFinite(value.elapsedSeconds) ? Number(value.elapsedSeconds) : 0,
      mode: value.mode as FocusTimerMode,
      segmentStartedAt:
        value.segmentStartedAt === null || Number.isFinite(value.segmentStartedAt)
          ? (value.segmentStartedAt ?? null)
          : null,
      sessionStartedAt:
        value.sessionStartedAt === null || Number.isFinite(value.sessionStartedAt)
          ? (value.sessionStartedAt ?? null)
          : null,
      status: value.status as TimerStatus,
      taskId: typeof value.taskId === 'string' ? value.taskId : '',
    };
  } catch {
    return initialState;
  }
}
