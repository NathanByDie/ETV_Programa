import { db } from "./firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, query, orderBy, Timestamp } from "firebase/firestore";

// Helper for local storage sync
const syncLocal = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const getLocal = (key: string) => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

export const api = {
  // Brigadistas
  getBrigadistas: async () => {
    try {
      const q = query(collection(db, "brigadistas"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      syncLocal('brigadistas', data);
      return data;
    } catch (e) {
      console.warn('Firebase error, using local storage', e);
      return getLocal('brigadistas');
    }
  },
  addBrigadista: async (nombre: string) => {
    try {
      const docRef = await addDoc(collection(db, "brigadistas"), {
        nombre,
        createdAt: new Date().toISOString()
      });
      return { id: docRef.id, nombre };
    } catch (e) {
      console.warn('Firebase error, saving locally', e);
      // Fallback
      return { id: `local-${Date.now()}`, nombre };
    }
  },
  deleteBrigadista: async (id: string) => {
    try {
      if (!id.startsWith('local-')) {
        await deleteDoc(doc(db, "brigadistas", id));
      }
    } catch (e) {
      console.warn('Firebase error', e);
    }
  },

  // Asignaciones
  getAsignaciones: async () => {
    try {
      const q = query(collection(db, "asignaciones"), orderBy("fecha", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => {
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
    try {
      const docRef = await addDoc(collection(db, "asignaciones"), {
        ...asignacion,
        fecha: Timestamp.now()
      });
      return { id: docRef.id, ...asignacion };
    } catch (e) {
      // Fallback
      return { id: `local-${Date.now()}`, ...asignacion };
    }
  },
  deleteAsignacion: async (id: string) => {
    try {
      if (!id.startsWith('local-')) {
        await deleteDoc(doc(db, "asignaciones", id));
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  // Croquis
  getAllCroquis: async () => {
    try {
      const q = query(collection(db, "croquis"), orderBy("updatedAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        elements: JSON.parse(d.data().data)
      }));
      syncLocal('all_croquis', data);
      return data;
    } catch (e) {
      return getLocal('all_croquis');
    }
  },
  getCroquis: async () => {
    try {
      const q = query(collection(db, "croquis"), orderBy("updatedAt", "desc"));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const data = JSON.parse(docData.data);
        localStorage.setItem('croquis', docData.data);
        return data;
      }
      return null;
    } catch (e) {
      const local = localStorage.getItem('croquis');
      return local ? JSON.parse(local) : null;
    }
  },
  saveCroquis: async (nombre: string, elements: any[], id?: string) => {
    try {
      const payload = {
        nombre,
        data: JSON.stringify(elements),
        updatedAt: new Date().toISOString()
      };
      if (id) {
        await updateDoc(doc(db, "croquis", id), payload);
      } else {
        await addDoc(collection(db, "croquis"), payload);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },
  deleteCroquis: async (id: string) => {
    try {
      await deleteDoc(doc(db, "croquis", id));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },
  renameCroquis: async (id: string, nombre: string) => {
    try {
      await updateDoc(doc(db, "croquis", id), { nombre, updatedAt: new Date().toISOString() });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
};
