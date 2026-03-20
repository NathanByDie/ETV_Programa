/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "./lib/firebase";
import { api } from "./lib/api";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Asignacion from "./pages/Asignacion";
import OperativoFoco from "./pages/OperativoFoco";
import Croquis from "./pages/Croquis";
import Historial from "./pages/Historial";
import Consolidado from "./pages/Consolidado";
import { View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import tw from "twrnc";

import { UnsavedChangesProvider } from "./contexts/UnsavedChangesContext";
import { LoadingProvider } from "./contexts/LoadingContext";

export default function App() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);

  useEffect(() => {
    // Test Firebase connection
    const testConn = async () => {
      try {
        await signInAnonymously(auth);
        setFirebaseConnected(true);
      } catch (error: any) {
        console.warn("Auth warning:", error.code);
        if (error.code === 'auth/configuration-not-found' || error.code === 'auth/admin-restricted-operation') {
          setAuthError("Nota: Autenticación anónima no habilitada. La app funcionará en modo DEMO si las reglas no permiten acceso público.");
          setFirebaseConnected(true); // Still connected to Firebase, just not authenticated
        } else if (error.code === 'auth/network-request-failed') {
          setAuthError("Error de red: No se pudo conectar con Firebase.");
          setFirebaseConnected(false);
        } else {
          setFirebaseConnected(true); // Assume connected for other errors
        }
      }
    };
    testConn();
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      if (!firebaseConnected) return; // Wait for Firebase to connect
      const queue = localStorage.getItem('sync_queue');
      if (queue && JSON.parse(queue).length > 0) {
        setIsSyncing(true);
        await api.syncOfflineChanges();
        setIsSyncing(false);
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check if we came online with pending changes
    if (navigator.onLine && firebaseConnected) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [firebaseConnected]);

  return (
    <LoadingProvider>
      <UnsavedChangesProvider>
        <View style={[tw`flex-1`, { height: '100%' }]}>
          <Router>
            <StatusBar style="auto" />
            {isOffline && (
              <View style={tw`bg-red-500 p-2 flex-row justify-center items-center shrink-0 z-50`}>
                <Text style={tw`text-white text-center text-sm font-bold`}>Modo Offline</Text>
              </View>
            )}
            {!isOffline && !firebaseConnected && (
              <View style={tw`bg-yellow-600 p-1 flex-row justify-center items-center shrink-0 z-50`}>
                <Text style={tw`text-white text-center text-[10px] font-bold`}>Conectando con Firebase...</Text>
              </View>
            )}
            {isSyncing && !isOffline && (
              <View style={tw`bg-blue-500 p-2 flex-row justify-center items-center shrink-0 z-50`}>
                <Text style={tw`text-white text-center text-sm font-bold`}>Actualizando...</Text>
              </View>
            )}
            {!!authError && (
              <View style={tw`bg-orange-500 p-2 flex-row justify-between items-center shrink-0`}>
                <Text style={tw`text-white text-center text-xs font-bold flex-1`}>{authError}</Text>
                <TouchableOpacity onPress={() => setAuthError(null)} style={tw`px-2`}>
                   <Text style={tw`text-white font-bold`}>X</Text>
                </TouchableOpacity>
              </View>
            )}
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/asignar" element={<Asignacion />} />
                <Route path="/foco" element={<OperativoFoco />} />
                <Route path="/croquis" element={<Croquis />} />
                <Route path="/historial" element={<Historial />} />
                <Route path="/consolidado" element={<Consolidado />} />
              </Routes>
            </Layout>
          </Router>
        </View>
      </UnsavedChangesProvider>
    </LoadingProvider>
  );
}
