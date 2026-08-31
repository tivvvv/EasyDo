import type { Habit } from '@easydo/domain';
import { calculateHabitStreak } from '@easydo/domain';
import { endOfWeek, format, parseISO, startOfWeek, subDays } from 'date-fns';
import { Pause, Play, Plus, RotateCcw, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useFocusTimer, type FocusTimerMode } from '../../hooks/useFocusTimer';
import type { ProductivityHubProps } from './types';

export function FocusTimer(props: ProductivityHubProps) {
  const timer = useFocusTimer({
    focusMinutes: props.settings.pomodoroMinutes,
    onComplete: async (session) => props.onAddFocusSession({ ...session, mode: 'pomodoro' }),
    shortBreakMinutes: props.settings.shortBreakMinutes,
  });
  const displayedSeconds = timer.remainingSeconds;
  const modeLabels: Array<{ label: string; value: FocusTimerMode }> = [
    { label: '专注', value: 'focus' },
    { label: '短休息', value: 'shortBreak' },
    { label: '正计时', value: 'stopwatch' },
  ];

  return (
    <div className="hub-panel focus-panel">
      <div className="hub-heading">
        <div>
          <p>一次只做好一件事</p>
          <h2>番茄专注</h2>
        </div>
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
          return (
            <article key={habit.id}>
              <header>
                <i style={{ background: habit.color }} />
                <strong>{habit.name}</strong>
                <span>
                  连续 {streak.current} 天 · 最长 {streak.longest} 天
                </span>
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
                  <strong>{Math.round((habit.logs.length / 30) * 100)}%</strong>近 30 天
                </span>
              </div>
              <div className="habit-heatmap" aria-label={`${habit.name}近 30 天记录`}>
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const done = habit.logs.includes(key);
                  return (
                    <button
                      aria-label={`${key}${done ? '已' : '未'}打卡`}
                      className={done ? 'done' : ''}
                      key={key}
                      onClick={() => void props.onToggleHabit(habit.id, key)}
                      title={`${format(day, 'M 月 d 日')} · ${done ? '已打卡' : '未打卡'}`}
                      type="button"
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
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
