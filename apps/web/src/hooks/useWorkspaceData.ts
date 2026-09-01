import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { sharedWorkspace } from '../lib/sharedWorkspace';

export function useWorkspaceData() {
  const data = useSyncExternalStore(
    sharedWorkspace.subscribe,
    sharedWorkspace.getSnapshot,
    sharedWorkspace.getSnapshot,
  );

  useEffect(() => {
    void sharedWorkspace.initialize().catch(() => undefined);
  }, []);

  return useMemo(
    () =>
      data
        ? {
            ...data,
            activities: [...data.activities]
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
              .slice(0, 50),
            categories: [...data.categories].sort((left, right) => left.order - right.order),
            countdowns: [...data.countdowns].sort((left, right) =>
              left.date.localeCompare(right.date),
            ),
            filters: [...data.filters].sort((left, right) => left.name.localeCompare(right.name)),
            focusSessions: [...data.focusSessions].sort((left, right) =>
              right.createdAt.localeCompare(left.createdAt),
            ),
            folders: [...data.folders].sort((left, right) => left.order - right.order),
            habits: [...data.habits].sort((left, right) =>
              left.createdAt.localeCompare(right.createdAt),
            ),
            sections: [...data.sections].sort((left, right) => left.order - right.order),
            tags: [...data.tags].sort((left, right) => left.name.localeCompare(right.name)),
            templates: [...data.templates].sort((left, right) =>
              left.name.localeCompare(right.name),
            ),
          }
        : undefined,
    [data],
  );
}
