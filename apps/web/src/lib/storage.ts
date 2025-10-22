import { openDB } from 'idb';
import { Moment } from '../components/MomentCard/MomentCard';

const DB_NAME = 'life-clock';
const DB_VERSION = 1;

export async function getDatabase() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('moments')) {
        db.createObjectStore('moments', { keyPath: 'id' });
      }
    }
  });
}

export async function loadMoments() {
  const db = await getDatabase();
  return (await db.getAll('moments')) as Moment[];
}

export async function saveMoment(moment: Moment) {
  const db = await getDatabase();
  await db.put('moments', moment);
}

export async function deleteMoment(id: string) {
  const db = await getDatabase();
  await db.delete('moments', id);
}
