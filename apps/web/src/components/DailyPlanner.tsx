import type { AppSettings, Category, Task } from '@easydo/domain';
import { CalendarCheck2, Clock3, Inbox, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  buildDailyPlan,
  findTaskSlot,
  getPlanningCandidates,
  getScheduledMinutes,
} from '../lib/dailyPlanner';

type DailyPlannerProps = {
  categories: Category[];
  date: string;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onMove: (taskId: string, date: string | null, time?: string | null) => Promise<void>;
  settings: AppSettings;
  tasks: Task[];
};

export function DailyPlanner({
  categories,
  date,
  onClose,
  onEdit,
  onMove,
  settings,
  tasks,
}: DailyPlannerProps) {
  const [planning, setPlanning] = useState(false);
  const activeTasks = tasks.filter((task) => !task.completedAt && !task.deletedAt);
  const scheduled = activeTasks.filter((task) => task.dueDate === date);
  const candidates = getPlanningCandidates(activeTasks, date);
  const scheduledMinutes = getScheduledMinutes(activeTasks, date);
  const load = Math.round((scheduledMinutes / settings.dailyCapacityMinutes) * 100);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const autoPlan = async () => {
    const plan = buildDailyPlan(activeTasks, date, settings);
    if (!plan.length) return;
    setPlanning(true);
    try {
      for (const slot of plan) await onMove(slot.taskId, slot.date, slot.time);
    } finally {
      setPlanning(false);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section aria-label="今日计划" aria-modal="true" className="daily-planner" role="dialog">
        <header>
          <div>
            <p>每日规划</p>
            <h2>{formatPlannerDate(date)}的时间安排</h2>
            <span>把过期和未安排任务放进真实可用的时间段.</span>
          </div>
          <button
            aria-label="关闭今日计划"
            className="icon-button ghost"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="daily-planner-summary">
          <article>
            <CalendarCheck2 size={18} />
            <div>
              <strong>{scheduled.length}</strong>
              <span>已安排任务</span>
            </div>
          </article>
          <article>
            <Clock3 size={18} />
            <div>
              <strong>{formatDuration(scheduledMinutes)}</strong>
              <span>{load}% 工作量</span>
            </div>
          </article>
          <article>
            <Inbox size={18} />
            <div>
              <strong>{candidates.length}</strong>
              <span>待规划任务</span>
            </div>
          </article>
          <div className="planner-capacity" aria-label={`当日容量 ${load}%`}>
            <span style={{ width: `${Math.min(100, load)}%` }} />
          </div>
        </div>

        <div className="daily-planner-columns">
          <section>
            <div className="planner-section-title">
              <div>
                <span>待规划</span>
                <small>按重要性和截止日期排序</small>
              </div>
              <button
                disabled={planning || candidates.length === 0}
                onClick={() => void autoPlan()}
                type="button"
              >
                <Sparkles size={15} />
                {planning ? '安排中...' : '自动安排'}
              </button>
            </div>
            <div className="planner-task-list">
              {candidates.length ? (
                candidates.map((task) => {
                  const slot = findTaskSlot(
                    activeTasks,
                    date,
                    task.estimateMinutes ?? task.duration,
                    settings,
                  );
                  const category = categoryById.get(task.categoryId);
                  return (
                    <article key={task.id}>
                      <i style={{ background: category?.color ?? '#7c6cf2' }} />
                      <button
                        className="planner-task-copy"
                        onClick={() => onEdit(task)}
                        type="button"
                      >
                        <strong>{task.title}</strong>
                        <span>
                          {task.dueDate ? `已过期于 ${task.dueDate}` : '尚未安排日期'} ·{' '}
                          {task.estimateMinutes ?? task.duration} 分钟
                        </span>
                      </button>
                      <button
                        disabled={!slot}
                        onClick={() => slot && void onMove(task.id, date, slot)}
                        title={slot ? `安排到 ${slot}` : '工作时段没有足够空档'}
                        type="button"
                      >
                        {slot ?? '无空档'}
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="planner-empty">
                  <CalendarCheck2 size={28} />
                  <strong>待规划任务已经清空</strong>
                  <span>今天的安排很明确, 可以开始行动了.</span>
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="planner-section-title">
              <div>
                <span>当天安排</span>
                <small>
                  {formatDuration(scheduledMinutes)} /{' '}
                  {formatDuration(settings.dailyCapacityMinutes)}
                </small>
              </div>
            </div>
            <div className="planner-task-list scheduled">
              {scheduled.length ? (
                [...scheduled].sort(compareScheduled).map((task) => {
                  const category = categoryById.get(task.categoryId);
                  return (
                    <article key={task.id}>
                      <i style={{ background: category?.color ?? '#7c6cf2' }} />
                      <button
                        className="planner-task-copy"
                        onClick={() => onEdit(task)}
                        type="button"
                      >
                        <strong>{task.title}</strong>
                        <span>
                          {task.dueTime ?? '全天'} · {task.estimateMinutes ?? task.duration} 分钟
                        </span>
                      </button>
                      <button onClick={() => void onMove(task.id, null, null)} type="button">
                        移回待规划
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="planner-empty">
                  <Clock3 size={28} />
                  <strong>当天还没有安排</strong>
                  <span>从左侧选择任务, 或使用自动安排.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function compareScheduled(left: Task, right: Task): number {
  return (
    (left.dueTime ?? '99:99').localeCompare(right.dueTime ?? '99:99') || left.order - right.order
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

function formatPlannerDate(date: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  }).format(new Date(`${date}T12:00:00`));
}
