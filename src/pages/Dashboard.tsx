import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { db } from "../lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, Clock, MapPin } from "lucide-react";
import tw from "twrnc";

interface Asignacion {
  id: string;
  lugarNombre: string;
  tipo: "fumigacion" | "abatizacion";
  brigadistaNombre: string;
  fecha: any;
  status: string;
}

export default function Dashboard() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const q = query(
          collection(db, "asignaciones"), 
          orderBy("fecha", "desc"), 
          limit(10)
        );
        const snapshot = await getDocs(q);
        setAsignaciones(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Asignacion)));
      } catch (e) {
        console.warn("Error fetching dashboard data", e);
        // Demo data
        setAsignaciones([
          { id: "d1", lugarNombre: "San Judas (Demo)", tipo: "fumigacion", brigadistaNombre: "Juan Pérez", fecha: { seconds: Date.now() / 1000 }, status: "pendiente" },
          { id: "d2", lugarNombre: "Las Jaguitas (Demo)", tipo: "abatizacion", brigadistaNombre: "Maria Lopez", fecha: { seconds: (Date.now() - 86400000) / 1000 }, status: "completado" }
        ] as Asignacion[]);
      }
    };
    fetchRecent();
  }, []);

  return (
    <View style={tw`flex-1`}>
      {/* Header Card */}
      <View style={tw`bg-blue-600 rounded-2xl p-6 shadow-lg mb-6`}>
        <Text style={tw`text-2xl font-bold text-white mb-1`}>Hola, Supervisor</Text>
        <Text style={tw`text-white opacity-90 text-sm`}>Resumen de actividad reciente</Text>
        
        <View style={tw`mt-6 flex-row gap-4`}>
          <View style={tw`bg-white/20 rounded-xl p-3 flex-1 items-center`}>
            <Text style={tw`text-2xl font-bold text-white`}>
              {asignaciones.filter(a => a.tipo === 'fumigacion').length}
            </Text>
            <Text style={tw`text-xs text-white opacity-80`}>Fumigaciones</Text>
          </View>
          <View style={tw`bg-white/20 rounded-xl p-3 flex-1 items-center`}>
            <Text style={tw`text-2xl font-bold text-white`}>
              {asignaciones.filter(a => a.tipo === 'abatizacion').length}
            </Text>
            <Text style={tw`text-xs text-white opacity-80`}>Abatizaciones</Text>
          </View>
        </View>
      </View>

      {/* Recent List */}
      <View>
        <Text style={tw`font-bold text-gray-800 mb-4 px-1 text-lg`}>Asignaciones Recientes</Text>
        <View style={tw`gap-3`}>
          {asignaciones.map((a) => (
            <View key={a.id} style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-row items-start`}>
              <View style={tw`mt-1 p-2 rounded-full mr-3 ${a.tipo === 'fumigacion' ? 'bg-blue-100' : 'bg-green-100'}`}>
                {a.tipo === 'fumigacion' ? <Clock size={16} color="#2563eb" /> : <CheckCircle size={16} color="#16a34a" />}
              </View>
              <View style={tw`flex-1`}>
                <View style={tw`flex-row justify-between items-start`}>
                  <Text style={tw`font-semibold text-gray-800 capitalize text-base`}>{a.lugarNombre}</Text>
                  <View style={tw`bg-gray-50 px-2 py-1 rounded-full`}>
                    <Text style={tw`text-xs text-gray-400`}>
                      {a.fecha?.seconds ? format(new Date(a.fecha.seconds * 1000), "d MMM", { locale: es }) : "Hoy"}
                    </Text>
                  </View>
                </View>
                <View style={tw`flex-row items-center mt-1`}>
                  <MapPin size={12} color="#6b7280" style={tw`mr-1`} />
                  <Text style={tw`text-sm text-gray-500 capitalize`}>{a.tipo}</Text>
                </View>
                <Text style={tw`text-xs text-gray-400 mt-2`}>
                  Brigadista: <Text style={tw`text-gray-600 font-medium`}>{a.brigadistaNombre}</Text>
                </Text>
              </View>
            </View>
          ))}
          {asignaciones.length === 0 && (
            <View style={tw`items-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200`}>
              <Text style={tw`text-gray-400 text-sm`}>No hay actividad reciente</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
