import React from "react";
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { Link, useLocation } from "react-router-dom";
import { Home, Users, ClipboardList, Map, History } from "lucide-react";
import tw from "twrnc";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "Inicio" },
    { path: "/asignar", icon: ClipboardList, label: "Asignar" },
    { path: "/asignar-mapa", icon: Map, label: "Mapa" },
    { path: "/historial", icon: History, label: "Historial" },
    { path: "/brigadistas", icon: Users, label: "Brigadas" },
    { path: "/croquis", icon: Map, label: "Croquis" },
  ];

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      {/* Header */}
      <View style={tw`bg-blue-600 pt-12 pb-4 px-4 z-20`}>
        <Text style={tw`text-xl font-bold text-center text-white`}>Gestor Brigadas</Text>
      </View>
      
      {/* Top Navigation - Fixed under header */}
      <View style={tw`bg-white border-b border-gray-200 flex-row justify-around items-center h-16 shadow-sm z-20`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{ textDecoration: 'none', flex: 1 }}
            >
              <View style={tw`items-center justify-center w-full h-full`}>
                <Icon size={22} color={isActive ? "#2563eb" : "#6b7280"} strokeWidth={isActive ? 2.5 : 2} />
                <Text style={tw`text-[10px] font-medium mt-1 ${isActive ? "text-blue-600" : "text-gray-500"}`}>
                  {item.label}
                </Text>
              </View>
            </Link>
          );
        })}
      </View>

      {/* Main Content Area */}
      <ScrollView 
        style={tw`flex-1`}
        contentContainerStyle={tw`p-4 pb-8`}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
