import type { Habit } from '@easydo/domain';
import { calculateHabitStreak } from '@easydo/domain';
import { endOfWeek, format, parseISO, startOfWeek, subDays } from 'date-fns';
import {
  Bell,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Square,
  Settings2,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useFocusTimer, type FocusTimerMode } from '../../hooks/useFocusTimer';
import type { ProductivityHubProps } from './types';

export function FocusTimer(props: ProductivityHubProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const timer = useFocusTimer({
    autoStartBreak: props.settings.autoStartBreak,
    focusMinutes: props.settings.pomodoroMinutes,
    focusRounds: props.settings.focusRounds,
    onComplete: props.onAddFocusSession,
    shortBreakMinutes: props.settings.shortBreakMinutes,
  });
  useFocusNoise(props.settings.whiteNoise, timer.running);
  const displayedSeconds = timer.remainingSeconds;
  const modeLabels: Array<{ label: string; value: FocusTimerMode }> = [
    { label: '专注', value: 'focus' },
    { label: '短休息', value: 'shortBreak' },
    { label: '正计时', value: 'stopwatch' },
  ];

  return (
    <div className={`hub-panel focus-panel${fullscreen ? ' focus-fullscreen' : ''}`}>
      <div className="hub-heading">
        <div>
          <p>一次只做好一件事</p>
          <h2>番茄专注</h2>
        </div>
        <button
          aria-label={fullscreen ? '退出沉浸模式' : '进入沉浸模式'}
          className="focus-fullscreen-button"
          onClick={() => setFullscreen((value) => !value)}
          type="button"
        >
          {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </div>
      <div className="focus-clock">
        <div className="focus-mode-switch" aria-label="计时模式">
          {modeLabels.map((item) => (
            <button
              className={timer.mode === item.value ? 'active' : ''}
              disabled={timer.running}
              key={item.value}
              onClick={() => timer.setMode(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <span>
          {String(Math.floor(displayedSeconds / 60)).padStart(2, '0')}:
          {String(displayedSeconds % 60).padStart(2, '0')}
        </span>
        <div className="focus-rounds" aria-label="番茄轮次">
          {Array.from({ length: props.settings.focusRounds }, (_, index) => (
            <i className={index + 1 <= timer.round ? 'active' : ''} key={index} />
          ))}
          第 {timer.round} 轮
        </div>
        <select
          aria-label="关联任务"
          disabled={timer.running}
          onChange={(event) => timer.setTaskId(event.target.value)}
          value={timer.taskId}
        >
          <option value="">不关联任务</option>
          {props.tasks
            .filter((task) => !task.completedAt)
            .map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
        </select>
        <div>
          <button className="primary-button" onClick={timer.startOrPause} type="button">
            {timer.running ? <Pause size={17} /> : <Play size={17} />}
            {timer.running ? '暂停' : '开始'}
          </button>
          <button className="secondary-button" onClick={timer.reset} type="button">
            <RotateCcw size={16} />
            重置
          </button>
          {(timer.elapsedSeconds >= 60 || timer.mode === 'stopwatch') && (
            <button className="secondary-button" onClick={() => void timer.finish()} type="button">
              <Square size={15} />
              完成本次
            </button>
          )}
        </div>
        <div className="focus-assists">
          <button onClick={timer.addInterruption} type="button">
            <Zap size={14} />
            记录中断 {timer.interruptions}
          </button>
          <label>
            {props.settings.whiteNoise === 'none' ? <VolumeX size={14} /> : <Volume2 size={14} />}
            环境声
            <select
              onChange={(event) =>
                void props.onUpdateSettings?.({
                  whiteNoise: event.target.value as 'brown' | 'none' | 'rain',
                })
              }
              value={props.settings.whiteNoise}
            >
              <option value="none">关闭</option>
              <option value="rain">雨声</option>
              <option value="brown">棕噪声</option>
            </select>
          </label>
          <label>
            <input
              checked={props.settings.autoStartBreak}
              onChange={(event) =>
                void props.onUpdateSettings?.({ autoStartBreak: event.target.checked })
              }
              type="checkbox"
            />
            自动开始休息
          </label>
        </div>
      </div>
      <p className="focus-summary">
        累计完成 {props.focusSessions.length} 次专注, 共{' '}
        {props.focusSessions.reduce((sum, item) => sum + item.durationMinutes, 0)} 分钟.
        {timer.running && ' 离开此页面后计时仍会继续.'}
      </p>
    </div>
  );
}

export function HabitTracker(props: ProductivityHubProps) {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const days = Array.from({ length: 30 }, (_, index) => subDays(new Date(), 29 - index));
  const [newHabitName, setNewHabitName] = useState('');
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const createHabit = async () => {
    if (!newHabitName.trim()) return;
    await props.onAddHabit(newHabitName.trim());
    setNewHabitName('');
  };

  return (
    <div className="hub-panel">
      <div className="hub-heading">
        <div>
          <p>小步积累可见进步</p>
          <h2>习惯打卡</h2>
        </div>
        <form
          className="habit-create"
          onSubmit={(event) => {
            event.preventDefault();
            void createHabit();
          }}
        >
          <input
            aria-label="新习惯名称"
            onChange={(event) => setNewHabitName(event.target.value)}
            placeholder="例如: 阅读 20 分钟"
            value={newHabitName}
          />
          <button className="secondary-button" disabled={!newHabitName.trim()} type="submit">
            <Plus size={15} />
            新建习惯
          </button>
        </form>
      </div>
      <div className="habit-list">
        {props.habits.map((habit) => {
          const streak = calculateHabitStreak(habit.logs, todayKey);
          const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
          const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
          const weeklyCount = habit.logs.filter((key) => {
            const date = parseISO(key);
            return date >= weekStart && date <= weekEnd;
          }).length;
          const monthlyDone = habit.logs.filter((key) =>
            days.some((day) => format(day, 'yyyy-MM-dd') === key),
          ).length;
          const monthlySkipped = (habit.skippedDates ?? []).filter((key) =>
            days.some((day) => format(day, 'yyyy-MM-dd') === key),
          ).length;
          return (
            <article className={habit.pausedAt ? 'paused' : ''} key={habit.id}>
              <header>
                <i style={{ background: habit.color }} />
                <strong>{habit.name}</strong>
                <span>
                  连续 {streak.current} 天 · 最长 {streak.longest} 天
                </span>
                {habit.pausedAt && <b className="habit-paused-chip">已暂停</b>}
                <button
                  aria-label={`设置习惯 ${habit.name}`}
                  className={editingHabitId === habit.id ? 'active' : ''}
                  onClick={() =>
                    setEditingHabitId((current) => (current === habit.id ? null : habit.id))
                  }
                  type="button"
                >
                  <Settings2 size={14} />
                </button>
              </header>
              {editingHabitId === habit.id && (
                <div className="habit-settings">
                  <label>
                    周期
                    <select
                      onChange={(event) =>
                        void props.onUpdateHabit(habit.id, {
                          frequency: event.target.value as Habit['frequency'],
                        })
                      }
                      value={habit.frequency}
                    >
                      <option value="daily">每天</option>
                      <option value="weekly">每周</option>
                    </select>
                  </label>
                  <label>
                    <Bell size={13} /> 提醒
                    <input
                      onChange={(event) =>
                        void props.onUpdateHabit(habit.id, {
                          reminderTime: event.target.value || null,
                        })
                      }
                      type="time"
                      value={habit.reminderTime ?? ''}
                    />
                  </label>
                  <button
                    onClick={() =>
                      void props.onUpdateHabit(habit.id, {
                        pausedAt: habit.pausedAt ? null : new Date().toISOString(),
                      })
                    }
                    type="button"
                  >
                    {habit.pausedAt ? <Play size={14} /> : <Pause size={14} />}
                    {habit.pausedAt ? '继续习惯' : '暂停习惯'}
                  </button>
                  <button
                    disabled={Boolean(habit.pausedAt)}
                    onClick={() => void props.onToggleHabitSkip?.(habit.id, todayKey)}
                    type="button"
                  >
                    <SkipForward size={14} />
                    {(habit.skippedDates ?? []).includes(todayKey) ? '取消跳过今天' : '跳过今天'}
                  </button>
                  <label>
                    目标次数
                    <input
                      min={1}
                      onChange={(event) =>
                        void props.onUpdateHabit(habit.id, { target: Number(event.target.value) })
                      }
                      type="number"
                      value={habit.target}
                    />
                  </label>
                  <button
                    className="danger"
                    onClick={() => void props.onDeleteHabit(habit.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                    删除习惯
                  </button>
                </div>
              )}
              <div className="habit-metrics">
                <span>
                  <strong>{habit.logs.length}</strong>
                  累计打卡
                </span>
                <span>
                  <strong>
                    {weeklyCount}/{habit.frequency === 'weekly' ? habit.target : 7}
                  </strong>
                  本周进度
                </span>
                <span>
                  <strong>
                    {Math.round((monthlyDone / Math.max(1, 30 - monthlySkipped)) * 100)}%
                  </strong>
                  近 30 天
                </span>
              </div>
              <div className="habit-heatmap" aria-label={`${habit.name}近 30 天记录`}>
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const done = habit.logs.includes(key);
                  const skipped = (habit.skippedDates ?? []).includes(key);
                  return (
                    <button
                      aria-label={`${key}${done ? '已' : '未'}打卡`}
                      className={done ? 'done' : skipped ? 'skipped' : ''}
                      disabled={Boolean(habit.pausedAt)}
                      key={key}
                      onClick={() => void props.onToggleHabit(habit.id, key)}
                      title={`${format(day, 'M 月 d 日')} · ${done ? '已打卡' : skipped ? '已跳过' : '未打卡'}`}
                      type="button"
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
              <footer className="habit-month-summary">
                本月完成 {monthlyDone} 次, 跳过 {monthlySkipped} 天.
                {(habit.goalHistory?.length ?? 0) > 0 &&
                  ` 目标调整 ${habit.goalHistory?.length ?? 0} 次.`}
              </footer>
            </article>
          );
        })}
        {props.habits.length === 0 && <p className="hub-empty">创建第一个习惯, 从今天开始打卡.</p>}
      </div>
      {props.habits.some((habit) => habit.logs.includes(todayKey)) && (
        <p className="habit-cheer">今天已经开始积累了.</p>
      )}
    </div>
  );
}

function useFocusNoise(kind: 'brown' | 'none' | 'rain', running: boolean) {
  const audioRef = useRef<{ context: AudioContext; source: AudioBufferSourceNode } | null>(null);
  useEffect(() => {
    if (!running || kind === 'none') return undefined;
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const sampleRate = context.sampleRate;
    const buffer = context.createBuffer(1, sampleRate * 3, sampleRate);
    const output = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < output.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = kind === 'brown' ? (previous + 0.02 * white) / 1.02 : white;
      output[index] = Math.max(-1, Math.min(1, previous * (kind === 'brown' ? 3.2 : 0.28)));
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = kind === 'brown' ? 0.11 : 0.08;
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(context.destination);
    source.start();
    audioRef.current = { context, source };
    return () => {
      source.stop();
      void context.close();
      audioRef.current = null;
    };
  }, [kind, running]);
}
