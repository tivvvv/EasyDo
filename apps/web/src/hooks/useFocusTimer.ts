import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type FocusTimerMode = 'focus' | 'shortBreak' | 'stopwatch';

type TimerStatus = 'idle' | 'paused' | 'running';

type TimerState = {
  elapsedSeconds: number;
  interruptions: number;
  mode: FocusTimerMode;
  round: number;
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
    interruptions: number;
    mode: 'pomodoro' | 'stopwatch';
    stage: number;
    startedAt: string;
    taskId: string | null;
  }) => Promise<void>;
  shortBreakMinutes: number;
  autoStartBreak?: boolean;
  focusRounds?: number;
};

const storageKey = 'easydo.focus-timer.v1';

const initialState: TimerState = {
  elapsedSeconds: 0,
  interruptions: 0,
  mode: 'focus',
  round: 1,
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
      state.mode === 'stopwatch' ||
      state.status !== 'running' ||
      remainingSeconds !== 0 ||
      !state.sessionStartedAt ||
      completingRef.current
    ) {
      return;
    }
    completingRef.current = true;
    if (state.mode === 'shortBreak') {
      queueMicrotask(() =>
        setState((current) => ({
          ...initialState,
          mode: 'focus',
          round: current.round,
          taskId: current.taskId,
        })),
      );
      completingRef.current = false;
      return;
    }
    const endedAt = new Date().toISOString();
    const nextRound = state.round >= (options.focusRounds ?? 4) ? 1 : state.round + 1;
    void completeRef
      .current({
        durationMinutes: options.focusMinutes,
        endedAt,
        interruptions: state.interruptions,
        mode: 'pomodoro',
        stage: state.round,
        startedAt: new Date(state.sessionStartedAt).toISOString(),
        taskId: state.taskId || null,
      })
      .finally(() => {
        const timestamp = Date.now();
        setState((current) => ({
          ...initialState,
          mode: 'shortBreak',
          round: nextRound,
          segmentStartedAt: options.autoStartBreak ? timestamp : null,
          sessionStartedAt: options.autoStartBreak ? timestamp : null,
          status: options.autoStartBreak ? 'running' : 'idle',
          taskId: current.taskId,
        }));
        completingRef.current = false;
      });
  }, [options.autoStartBreak, options.focusMinutes, options.focusRounds, remainingSeconds, state]);

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
      interruptions: 0,
      segmentStartedAt: null,
      sessionStartedAt: null,
      status: 'idle',
    }));
  }, []);

  const addInterruption = useCallback(() => {
    setState((current) => ({ ...current, interruptions: current.interruptions + 1 }));
  }, []);

  const finish = useCallback(async () => {
    if (!state.sessionStartedAt || elapsedSeconds < 60 || state.mode === 'shortBreak') {
      reset();
      return;
    }
    await completeRef.current({
      durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      endedAt: new Date().toISOString(),
      interruptions: state.interruptions,
      mode: state.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
      stage: state.round,
      startedAt: new Date(state.sessionStartedAt).toISOString(),
      taskId: state.taskId || null,
    });
    reset();
  }, [elapsedSeconds, reset, state]);

  const setMode = useCallback((mode: FocusTimerMode) => {
    setState((current) => ({
      ...initialState,
      mode,
      round: current.round,
      taskId: current.taskId,
    }));
  }, []);

  const setTaskId = useCallback((taskId: string) => {
    setState((current) => ({ ...current, taskId }));
  }, []);

  return useMemo(
    () => ({
      elapsedSeconds,
      addInterruption,
      finish,
      interruptions: state.interruptions,
      mode: state.mode,
      remainingSeconds,
      reset,
      round: state.round,
      running: state.status === 'running',
      setMode,
      setTaskId,
      startOrPause,
      taskId: state.taskId,
    }),
    [
      addInterruption,
      elapsedSeconds,
      finish,
      remainingSeconds,
      reset,
      setMode,
      setTaskId,
      startOrPause,
      state,
    ],
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
      interruptions: Number.isFinite(value.interruptions) ? Number(value.interruptions) : 0,
      mode: value.mode as FocusTimerMode,
      round: Number.isFinite(value.round) ? Math.max(1, Number(value.round)) : 1,
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
