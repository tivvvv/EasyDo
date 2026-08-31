import { db, initializeDatabase } from '@easydo/storage';
import { defaultAppSettings } from '@easydo/domain';
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

    const [
      activities,
      tasks,
      categories,
      countdowns,
      filters,
      focusSessions,
      folders,
      habits,
      sections,
      settings,
      tags,
      templates,
    ] = await Promise.all([
      db.activities.orderBy('createdAt').reverse().limit(50).toArray(),
      db.tasks.toArray(),
      db.categories.orderBy('order').toArray(),
      db.countdowns.orderBy('date').toArray(),
      db.filters.orderBy('name').toArray(),
      db.focusSessions.orderBy('createdAt').reverse().toArray(),
      db.folders.orderBy('order').toArray(),
      db.habits.orderBy('createdAt').toArray(),
      db.sections.orderBy('order').toArray(),
      db.settings.get('default'),
      db.tags.orderBy('name').toArray(),
      db.templates.orderBy('name').toArray(),
    ]);

    return {
      activities,
      categories,
      countdowns,
      filters,
      focusSessions,
      folders,
      habits,
      sections,
      settings: settings ?? { ...defaultAppSettings },
      tags,
      tasks,
      templates,
    };
  }, [ready]);
}
