import { TaskApplicationService } from '@easydo/application';
import { DexieActivityRepository, DexieTaskRepository } from '@easydo/storage';

export const taskService = new TaskApplicationService(
  new DexieTaskRepository(),
  new DexieActivityRepository(),
);
