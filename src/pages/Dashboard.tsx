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
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const fetchRecent = async () => {
      setIsFetching(true);
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
      } finally {
        setIsFetching(false);
      }
    };
    fetchRecent();
  }, []);

  return (
    <View style={tw`flex-1 p-4`}>
      {/* Header Card */}
      <View style={tw`bg-[#dcf0fa] rounded-2xl p-6 shadow-lg mb-6 shrink-0`}>
        
        <View style={tw`flex-row gap-4`}>
          <View style={tw`bg-white/40 rounded-xl p-3 flex-1 items-center`}>
            <Text style={tw`text-2xl font-bold text-blue-900`}>
              {asignaciones.filter(a => a.tipo === 'fumigacion').length}
            </Text>
            <Text style={tw`text-xs text-blue-800 opacity-80`}>Fumigaciones</Text>
          </View>
          <View style={tw`bg-white/40 rounded-xl p-3 flex-1 items-center`}>
            <Text style={tw`text-2xl font-bold text-blue-900`}>
              {asignaciones.filter(a => a.tipo === 'abatizacion').length}
            </Text>
            <Text style={tw`text-xs text-blue-800 opacity-80`}>Aplicaciones</Text>
          </View>
        </View>
      </View>

      {/* Recent List */}
      <View style={tw`flex-1`}>
        <Text style={tw`font-bold text-gray-800 mb-4 px-1 text-lg shrink-0`}>Asignaciones Recientes</Text>
        <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`}>
          <View style={tw`gap-3`}>
            {isFetching ? (
              <Text style={tw`text-center text-gray-500 py-8`}>Cargando...</Text>
            ) : asignaciones.length === 0 ? (
              <View style={tw`items-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200`}>
                <Text style={tw`text-gray-400 text-sm`}>No hay actividad reciente</Text>
              </View>
            ) : (
              asignaciones.map((a) => (
                <View key={a.id} style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-row items-start`}>
                  <View style={tw`mt-1 p-2 rounded-full mr-3 ${a.tipo === 'fumigacion' ? 'bg-[#dcf0fa]' : 'bg-green-100'}`}>
                    {a.tipo === 'fumigacion' ? <Clock size={16} color="#0284c7" /> : <CheckCircle size={16} color="#16a34a" />}
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
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
