import { TaskApplicationService } from '@easydo/application';

import { SharedActivityRepository, SharedTaskRepository } from './sharedStorage';

export const taskService = new TaskApplicationService(
  new SharedTaskRepository(),
  new SharedActivityRepository(),
);
