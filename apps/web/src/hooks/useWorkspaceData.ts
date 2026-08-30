import { db, initializeDatabase } from '@easydo/storage';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

export function useWorkspaceData() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void initializeDatabase().then(() => {
      if (active) {
        setReady(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return useLiveQuery(async () => {
    if (!ready) {
      return undefined;
    }

    const [tasks, categories, tags] = await Promise.all([
      db.tasks.toArray(),
      db.categories.orderBy('order').toArray(),
      db.tags.orderBy('name').toArray(),
    ]);

    return { categories, tags, tasks };
  }, [ready]);
}
