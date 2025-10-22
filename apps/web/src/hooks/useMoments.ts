import { useEffect } from 'react';
import { useLifeStore } from '../store/lifeStore';
import { deleteMoment, loadMoments, saveMoment } from '../lib/storage';

export function useMomentsSync() {
  const moments = useLifeStore((state) => state.moments);
  const upsertMoment = useLifeStore((state) => state.upsertMoment);
  const removeMoment = useLifeStore((state) => state.removeMoment);

  useEffect(() => {
    loadMoments().then((records) => {
      records.forEach((moment) => upsertMoment(moment));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    moments.forEach((moment) => {
      void saveMoment(moment);
    });
  }, [moments]);

  return {
    removeAndPersist: async (id: string) => {
      removeMoment(id);
      await deleteMoment(id);
    }
  };
}
