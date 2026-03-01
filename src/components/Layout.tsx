import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Image } from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, ClipboardList, Map, History } from "lucide-react";
import tw from "twrnc";
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const navItems = [
    { path: "/", icon: Home, label: "Inicio" },
    { path: "/asignar", icon: ClipboardList, label: "Asignar" },
    { path: "/historial", icon: History, label: "Historial" },
    { path: "/croquis", icon: Map, label: "Croquis" },
  ];

  const handleNavigation = (path: string) => {
    if (path === location.pathname) return;
    
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
    } else {
      navigate(path);
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      {/* Header */}
      <View style={tw`bg-[#dcf0fa] pt-12 pb-4 px-4 z-20 flex-row items-center justify-between`}>
        <View style={tw`bg- rounded p-1`}>
          <Image 
            source={{ uri: 'https://www.minsa.gob.ni/sites/default/files/Logo-01.png' }} 
            style={tw`w-42 h-20`}
            resizeMode="contain"
          />
        </View>
        <Text style={tw`text-xl font-bold text-blue-900`}>Gestor Brigadas</Text>
      </View>
      
      {/* Top Navigation - Fixed under header */}
      <View style={tw`bg-white border-b border-gray-200 flex-row justify-around items-center h-16 shadow-sm z-20`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <TouchableOpacity
              key={item.path}
              onPress={() => handleNavigation(item.path)}
              style={tw`flex-1`}
            >
              <View style={tw`items-center justify-center w-full h-full`}>
                <Icon size={22} color={isActive ? "#0284c7" : "#6b7280"} strokeWidth={isActive ? 2.5 : 2} />
                <Text style={tw`text-[10px] font-medium mt-1 ${isActive ? "text-sky-600" : "text-gray-500"}`}>
                  {item.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Content Area */}
      {location.pathname === '/croquis' ? (
        <View style={tw`flex-1`}>
          {children}
        </View>
      ) : (
        <ScrollView 
          style={tw`flex-1`}
          contentContainerStyle={tw`p-4 pb-8`}
        >
          {children}
        </ScrollView>
      )}

      {/* Unsaved Changes Dialog */}
      {pendingNavigation && (
        <View style={[tw`absolute inset-0 bg-black/50 z-50 items-center justify-center`, { position: 'absolute' as any }]}>
          <View style={tw`bg-white p-6 rounded-xl w-80 shadow-xl`}>
            <Text style={tw`text-lg font-bold text-gray-800 mb-2`}>Cambios sin guardar</Text>
            <Text style={tw`text-sm text-gray-600 mb-6`}>Tienes modificaciones en el croquis. ¿Estás seguro que deseas salir sin guardar?</Text>
            <View style={tw`flex-row justify-end gap-3`}>
              <TouchableOpacity
                onPress={() => setPendingNavigation(null)}
                style={tw`px-4 py-2 rounded-lg bg-gray-100`}
              >
                <Text style={tw`text-gray-700 font-medium`}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setHasUnsavedChanges(false);
                  navigate(pendingNavigation);
                  setPendingNavigation(null);
                }}
                style={tw`px-4 py-2 rounded-lg bg-red-600`}
              >
                <Text style={tw`text-white font-medium`}>Salir sin guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
