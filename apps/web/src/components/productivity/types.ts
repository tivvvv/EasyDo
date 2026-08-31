import type {
  AppSettings,
  Category,
  Countdown,
  FocusSession,
  Habit,
  HabitPatch,
  Section,
  Task,
} from '@easydo/domain';

export type ProductivityHubProps = {
  categories: Category[];
  countdowns: Countdown[];
  focusSessions: FocusSession[];
  habits: Habit[];
  onAddCountdown: (title: string, date: string) => Promise<void>;
  onAddFocusSession: (session: {
    durationMinutes: number;
    endedAt: string;
    mode: FocusSession['mode'];
    startedAt: string;
    taskId: string | null;
  }) => Promise<void>;
  onAddHabit: (name: string) => Promise<void>;
  onAddSection: (categoryId: string, name: string) => Promise<void>;
  onCreateTask: (prefill: {
    categoryId?: string;
    dueDate?: string | null;
    important?: boolean;
    sectionId?: string | null;
  }) => void;
  onDeleteCountdown: (id: string) => Promise<void>;
  onDeleteHabit: (id: string) => Promise<void>;
  onDeleteSection: (id: string) => Promise<void>;
  onEdit: (task: Task) => void;
  onToggleHabit: (id: string, dateKey: string) => Promise<void>;
  onUpdateHabit: (id: string, patch: HabitPatch) => Promise<void>;
  onUpdateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  sections: Section[];
  settings: AppSettings;
  tasks: Task[];
};
