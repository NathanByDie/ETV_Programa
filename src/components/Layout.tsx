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
    <SafeAreaView style={tw`flex-1 h-screen bg-gray-50`}>
      {/* Header */}
      <View style={tw`bg-blue-600 pt-12 pb-4 px-4 shadow-md z-10`}>
        <Text style={tw`text-xl font-bold text-center text-white`}>Gestor Brigadas</Text>
      </View>
      
      {/* Main Content */}
      <ScrollView style={tw`flex-1 p-4 mb-20`}>
        {children}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={tw`absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex-row justify-around items-center h-16 pb-2`}>
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
                <Icon size={24} color={isActive ? "#2563eb" : "#6b7280"} strokeWidth={isActive ? 2.5 : 2} />
                <Text style={tw`text-xs font-medium ${isActive ? "text-blue-600" : "text-gray-500"}`}>
                  {item.label}
                </Text>
              </View>
            </Link>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
