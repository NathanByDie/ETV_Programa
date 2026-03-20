import { db } from "./firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, query, orderBy, Timestamp, Query } from "firebase/firestore";

// Helper for local storage sync
const syncLocal = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Error saving to local storage', e);
  }
};

const getLocal = (key: string) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('Error reading from local storage', e);
    return [];
  }
};

const isOnline = () => {
  // In Electron, navigator.onLine can be unreliable.
  // We check both navigator.onLine and a custom flag if needed.
  return navigator.onLine;
};

const addToSyncQueue = (action: any) => {
  const queue = getLocal('sync_queue');
  const currentQueue = Array.isArray(queue) ? queue : [];
  currentQueue.push(action);
  syncLocal('sync_queue', currentQueue);
  window.dispatchEvent(new Event('offline_changes_pending'));
};

// Helper to prevent infinite hanging on getDocs
const getDocsWithTimeout = async (q: Query, timeoutMs = 4000) => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Firebase request timeout')), timeoutMs)
  );
  try {
    return await Promise.race([getDocs(q), timeoutPromise]) as any;
  } catch (e) {
    console.warn('getDocsWithTimeout failed or timed out:', e);
    throw e;
  }
};

export const api = {
  syncOfflineChanges: async () => {
    if (!isOnline()) return false;
    const queue = getLocal('sync_queue');
    if (!Array.isArray(queue) || queue.length === 0) return true;

    const idMap = new Map<string, string>();

    for (const action of queue) {
      try {
        if (action.type === 'addBrigadista') {
          const { id, ...payload } = action.payload;
          const docRef = await addDoc(collection(db, "brigadistas"), payload);
          if (id && id.startsWith('local-')) idMap.set(id, docRef.id);
        } else if (action.type === 'deleteBrigadista') {
          let targetId = action.payload.id;
          if (targetId.startsWith('local-')) targetId = idMap.get(targetId) || targetId;
          if (!targetId.startsWith('local-')) {
            await deleteDoc(doc(db, "brigadistas", targetId));
          }
        } else if (action.type === 'addAsignacion') {
          const { id, ...payload } = action.payload;
          const docRef = await addDoc(collection(db, "asignaciones"), payload);
          if (id && id.startsWith('local-')) idMap.set(id, docRef.id);
        } else if (action.type === 'deleteAsignacion') {
          let targetId = action.payload.id;
          if (targetId.startsWith('local-')) targetId = idMap.get(targetId) || targetId;
          if (!targetId.startsWith('local-')) {
            await deleteDoc(doc(db, "asignaciones", targetId));
          }
        } else if (action.type === 'saveCroquis') {
          const { id, nombre, elements, updatedAt } = action.payload;
          const payload = { nombre, data: JSON.stringify(elements), updatedAt };
          let targetId = id;
          if (targetId && targetId.startsWith('local-')) {
             targetId = idMap.get(targetId) || targetId;
          }
          
          if (targetId && !targetId.startsWith('local-')) {
            await updateDoc(doc(db, "croquis", targetId), payload);
          } else {
            const docRef = await addDoc(collection(db, "croquis"), payload);
            if (id && id.startsWith('local-')) {
              idMap.set(id, docRef.id);
            }
          }
        } else if (action.type === 'deleteCroquis') {
          let targetId = action.payload.id;
          if (targetId.startsWith('local-')) targetId = idMap.get(targetId) || targetId;
          if (!targetId.startsWith('local-')) {
            await deleteDoc(doc(db, "croquis", targetId));
          }
        } else if (action.type === 'renameCroquis') {
          let targetId = action.payload.id;
          if (targetId.startsWith('local-')) targetId = idMap.get(targetId) || targetId;
          if (!targetId.startsWith('local-')) {
            await updateDoc(doc(db, "croquis", targetId), { nombre: action.payload.nombre, updatedAt: new Date().toISOString() });
          }
        } else if (action.type === 'addConsolidado') {
          const { id, ...payload } = action.payload;
          const docRef = await addDoc(collection(db, "consolidados"), payload);
          if (id && id.startsWith('local-')) idMap.set(id, docRef.id);
        } else if (action.type === 'deleteConsolidado') {
          let targetId = action.payload.id;
          if (targetId.startsWith('local-')) targetId = idMap.get(targetId) || targetId;
          if (!targetId.startsWith('local-')) {
            await deleteDoc(doc(db, "consolidados", targetId));
          }
        }
      } catch (e) {
        console.error('Error syncing action', action, e);
      }
    }

    syncLocal('sync_queue', []);
    return true;
  },

  // Brigadistas
  getBrigadistas: async () => {
    try {
      if (!isOnline()) throw new Error('Offline');
      const q = query(collection(db, "brigadistas"), orderBy("createdAt", "desc"));
      const snapshot = await getDocsWithTimeout(q);
      const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      syncLocal('brigadistas', data);
      return data;
    } catch (e) {
      console.warn('Firebase error, using local storage', e);
      return getLocal('brigadistas');
    }
  },
  addBrigadista: async (nombre: string) => {
    const payload = { nombre, createdAt: new Date().toISOString() };
    if (!isOnline()) {
      const id = `local-${Date.now()}`;
      const localData = { id, ...payload };
      const current = getLocal('brigadistas');
      syncLocal('brigadistas', [localData, ...current]);
      addToSyncQueue({ type: 'addBrigadista', payload: localData });
      return localData;
    }
    try {
      const docRef = await addDoc(collection(db, "brigadistas"), payload);
      const data = { id: docRef.id, ...payload };
      const current = getLocal('brigadistas');
      syncLocal('brigadistas', [data, ...current]);
      return data;
    } catch (e) {
      console.warn('Firebase error, saving locally', e);
      const id = `local-${Date.now()}`;
      const localData = { id, ...payload };
      const current = getLocal('brigadistas');
      syncLocal('brigadistas', [localData, ...current]);
      addToSyncQueue({ type: 'addBrigadista', payload: localData });
      return localData;
    }
  },
  deleteBrigadista: async (id: string) => {
    if (!isOnline()) {
      const current = getLocal('brigadistas').filter((b: any) => b.id !== id);
      syncLocal('brigadistas', current);
      addToSyncQueue({ type: 'deleteBrigadista', payload: { id } });
      return;
    }
    try {
      if (!id.startsWith('local-')) {
        await deleteDoc(doc(db, "brigadistas", id));
      }
      const current = getLocal('brigadistas').filter((b: any) => b.id !== id);
      syncLocal('brigadistas', current);
    } catch (e) {
      console.warn('Firebase error', e);
      const current = getLocal('brigadistas').filter((b: any) => b.id !== id);
      syncLocal('brigadistas', current);
      addToSyncQueue({ type: 'deleteBrigadista', payload: { id } });
    }
  },

  // Asignaciones
  getAsignaciones: async () => {
    try {
      if (!isOnline()) throw new Error('Offline');
      const q = query(collection(db, "asignaciones"), orderBy("fecha", "desc"));
      const snapshot = await getDocsWithTimeout(q);
      const data = snapshot.docs.map((d: any) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          fecha: data.fecha instanceof Timestamp ? data.fecha.toDate().toISOString() : data.fecha
        };
      });
      syncLocal('asignaciones', data);
      return data;
    } catch (e) {
      return getLocal('asignaciones');
    }
  },
  addAsignacion: async (asignacion: any) => {
    const payload = { ...asignacion, fecha: new Date().toISOString() };
    if (!isOnline()) {
      const id = `local-${Date.now()}`;
      const localData = { id, ...payload };
      const current = getLocal('asignaciones');
      syncLocal('asignaciones', [localData, ...current]);
      addToSyncQueue({ type: 'addAsignacion', payload: localData });
      return localData;
    }
    try {
      const docRef = await addDoc(collection(db, "asignaciones"), payload);
      const data = { id: docRef.id, ...payload };
      const current = getLocal('asignaciones');
      syncLocal('asignaciones', [data, ...current]);
      return data;
    } catch (e) {
      const id = `local-${Date.now()}`;
      const localData = { id, ...payload };
      const current = getLocal('asignaciones');
      syncLocal('asignaciones', [localData, ...current]);
      addToSyncQueue({ type: 'addAsignacion', payload: localData });
      return localData;
    }
  },
  deleteAsignacion: async (id: string) => {
    if (!isOnline()) {
      const current = getLocal('asignaciones').filter((a: any) => a.id !== id);
      syncLocal('asignaciones', current);
      addToSyncQueue({ type: 'deleteAsignacion', payload: { id } });
      return true;
    }
    try {
      if (!id.startsWith('local-')) {
        await deleteDoc(doc(db, "asignaciones", id));
      }
      const current = getLocal('asignaciones').filter((a: any) => a.id !== id);
      syncLocal('asignaciones', current);
      return true;
    } catch (e) {
      console.error(e);
      const current = getLocal('asignaciones').filter((a: any) => a.id !== id);
      syncLocal('asignaciones', current);
      addToSyncQueue({ type: 'deleteAsignacion', payload: { id } });
      return false;
    }
  },

  // Croquis
  getAllCroquis: async () => {
    try {
      // Always return local data immediately if offline
      if (!isOnline()) return getLocal('all_croquis');

      const q = query(collection(db, "croquis"), orderBy("updatedAt", "desc"));
      
      // Try to get from server with a strict timeout
      try {
        const snapshot = await getDocsWithTimeout(q, 3000);
        const data = snapshot.docs.map((d: any) => {
          const docData = d.data();
          let elements = [];
          try {
            if (docData.data) {
              elements = typeof docData.data === 'string' ? JSON.parse(docData.data) : docData.data;
            }
          } catch (err) {
            console.warn('Error parsing croquis elements for doc:', d.id, err);
          }
          return {
            id: d.id,
            ...docData,
            elements: Array.isArray(elements) ? elements : []
          };
        });
        syncLocal('all_croquis', data);
        return data;
      } catch (timeoutErr) {
        console.warn('Firebase fetch timed out, using local data', timeoutErr);
        return getLocal('all_croquis');
      }
    } catch (e) {
      console.error('Error in getAllCroquis:', e);
      return getLocal('all_croquis');
    }
  },
  getCroquis: async () => {
    try {
      if (!isOnline()) return getLocal('croquis');

      const q = query(collection(db, "croquis"), orderBy("updatedAt", "desc"));
      try {
        const snapshot = await getDocsWithTimeout(q, 3000);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          let data = [];
          try {
            if (docData.data) {
              data = typeof docData.data === 'string' ? JSON.parse(docData.data) : docData.data;
            }
          } catch (err) {
            console.warn('Error parsing croquis elements', err);
          }
          const finalData = Array.isArray(data) ? data : [];
          syncLocal('croquis', JSON.stringify(finalData));
          return finalData;
        }
        return null;
      } catch (timeoutErr) {
        const local = getLocal('croquis');
        return local ? local : null;
      }
    } catch (e) {
      const local = getLocal('croquis');
      return local ? local : null;
    }
  },
  saveCroquis: async (nombre: string, elements: any[], id?: string) => {
    const payload = {
      nombre,
      data: JSON.stringify(elements),
      updatedAt: new Date().toISOString()
    };
    if (!isOnline()) {
      const localId = id || `local-${Date.now()}`;
      const localData = { id: localId, ...payload, elements };
      const currentAll = getLocal('all_croquis');
      const existingIndex = currentAll.findIndex((c: any) => c.id === localId);
      if (existingIndex >= 0) {
        currentAll[existingIndex] = localData;
      } else {
        currentAll.unshift(localData);
      }
      syncLocal('all_croquis', currentAll);
      addToSyncQueue({ type: 'saveCroquis', payload: { id: localId, nombre, elements, updatedAt: payload.updatedAt } });
      return true;
    }
    try {
      if (id && !id.startsWith('local-')) {
        await updateDoc(doc(db, "croquis", id), payload);
      } else {
        await addDoc(collection(db, "croquis"), payload);
      }
      return true;
    } catch (e) {
      console.error(e);
      const localId = id || `local-${Date.now()}`;
      const localData = { id: localId, ...payload, elements };
      const currentAll = getLocal('all_croquis');
      const existingIndex = currentAll.findIndex((c: any) => c.id === localId);
      if (existingIndex >= 0) {
        currentAll[existingIndex] = localData;
      } else {
        currentAll.unshift(localData);
      }
      syncLocal('all_croquis', currentAll);
      addToSyncQueue({ type: 'saveCroquis', payload: { id: localId, nombre, elements, updatedAt: payload.updatedAt } });
      return false;
    }
  },
  deleteCroquis: async (id: string) => {
    if (!isOnline()) {
      const currentAll = getLocal('all_croquis').filter((c: any) => c.id !== id);
      syncLocal('all_croquis', currentAll);
      addToSyncQueue({ type: 'deleteCroquis', payload: { id } });
      return true;
    }
    try {
      if (!id.startsWith('local-')) {
        await deleteDoc(doc(db, "croquis", id));
      }
      const currentAll = getLocal('all_croquis').filter((c: any) => c.id !== id);
      syncLocal('all_croquis', currentAll);
      return true;
    } catch (e) {
      console.error(e);
      const currentAll = getLocal('all_croquis').filter((c: any) => c.id !== id);
      syncLocal('all_croquis', currentAll);
      addToSyncQueue({ type: 'deleteCroquis', payload: { id } });
      return false;
    }
  },
  renameCroquis: async (id: string, nombre: string) => {
    if (!isOnline()) {
      const currentAll = getLocal('all_croquis');
      const croquis = currentAll.find((c: any) => c.id === id);
      if (croquis) {
        croquis.nombre = nombre;
        syncLocal('all_croquis', currentAll);
      }
      addToSyncQueue({ type: 'renameCroquis', payload: { id, nombre } });
      return true;
    }
    try {
      if (!id.startsWith('local-')) {
        await updateDoc(doc(db, "croquis", id), { nombre, updatedAt: new Date().toISOString() });
      }
      const currentAll = getLocal('all_croquis');
      const croquis = currentAll.find((c: any) => c.id === id);
      if (croquis) {
        croquis.nombre = nombre;
        syncLocal('all_croquis', currentAll);
      }
      return true;
    } catch (e) {
      console.error(e);
      const currentAll = getLocal('all_croquis');
      const croquis = currentAll.find((c: any) => c.id === id);
      if (croquis) {
        croquis.nombre = nombre;
        syncLocal('all_croquis', currentAll);
      }
      addToSyncQueue({ type: 'renameCroquis', payload: { id, nombre } });
      return false;
    }
  },

  // Consolidados
  getConsolidados: async () => {
    try {
      if (!isOnline()) throw new Error('Offline');
      const q = query(collection(db, "consolidados"), orderBy("fecha", "desc"));
      const snapshot = await getDocsWithTimeout(q);
      const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      syncLocal('consolidados', data);
      return data;
    } catch (e) {
      console.warn('Firebase error, using local storage', e);
      return getLocal('consolidados');
    }
  },
  addConsolidado: async (payload: any) => {
    const dataWithTimestamp = { ...payload, createdAt: new Date().toISOString() };
    if (!isOnline()) {
      const id = `local-${Date.now()}`;
      const localData = { id, ...dataWithTimestamp };
      const current = getLocal('consolidados');
      syncLocal('consolidados', [localData, ...current]);
      addToSyncQueue({ type: 'addConsolidado', payload: localData });
      return localData;
    }
    try {
      const docRef = await addDoc(collection(db, "consolidados"), dataWithTimestamp);
      const data = { id: docRef.id, ...dataWithTimestamp };
      const current = getLocal('consolidados');
      syncLocal('consolidados', [data, ...current]);
      return data;
    } catch (e) {
      console.warn('Firebase error, saving locally', e);
      const id = `local-${Date.now()}`;
      const localData = { id, ...dataWithTimestamp };
      const current = getLocal('consolidados');
      syncLocal('consolidados', [localData, ...current]);
      addToSyncQueue({ type: 'addConsolidado', payload: localData });
      return localData;
    }
  },
  deleteConsolidado: async (id: string) => {
    if (!isOnline()) {
      const current = getLocal('consolidados');
      syncLocal('consolidados', current.filter((c: any) => c.id !== id));
      addToSyncQueue({ type: 'deleteConsolidado', payload: { id } });
      return true;
    }
    try {
      await deleteDoc(doc(db, "consolidados", id));
      const current = getLocal('consolidados');
      syncLocal('consolidados', current.filter((c: any) => c.id !== id));
      return true;
    } catch (e) {
      console.warn('Firebase error, deleting locally', e);
      const current = getLocal('consolidados');
      syncLocal('consolidados', current.filter((c: any) => c.id !== id));
      addToSyncQueue({ type: 'deleteConsolidado', payload: { id } });
      return true;
    }
  }
};

