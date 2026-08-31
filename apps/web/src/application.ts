import { TaskApplicationService } from '@easydo/application';
import { DexieTaskRepository } from '@easydo/storage';

export const taskService = new TaskApplicationService(new DexieTaskRepository());
