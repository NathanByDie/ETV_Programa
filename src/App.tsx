/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "./lib/firebase";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Asignacion from "./pages/Asignacion";
import Croquis from "./pages/Croquis";
import Historial from "./pages/Historial";
import { View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import tw from "twrnc";

import { UnsavedChangesProvider } from "./contexts/UnsavedChangesContext";

export default function App() {
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    signInAnonymously(auth).catch((error) => {
      console.warn("Auth warning:", error.code); // Warn instead of error to reduce noise
      if (error.code === 'auth/configuration-not-found' || error.code === 'auth/admin-restricted-operation') {
        setAuthError("Nota: Autenticación anónima no habilitada. La app funcionará en modo DEMO (sin guardar datos).");
      }
    });
  }, []);

  return (
    <UnsavedChangesProvider>
      <Router>
        <StatusBar style="auto" />
        {authError && (
          <View style={tw`bg-orange-500 p-2 flex-row justify-between items-center`}>
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
            <Route path="/croquis" element={<Croquis />} />
            <Route path="/historial" element={<Historial />} />
          </Routes>
        </Layout>
      </Router>
    </UnsavedChangesProvider>
  );
}
