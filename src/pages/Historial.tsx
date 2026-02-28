import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2, Search, Filter, MapPin, Calendar } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";

interface Asignacion {
  id: string;
  lugarNombre: string;
  lugarType: string;
  tipo: "fumigacion" | "abatizacion";
  brigadistaNombre: string;
  manzanas: string[];
  fecha: string; // ISO string from API
}

export default function Historial() {
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [filtered, setFiltered] = useState<Asignacion[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "fumigacion" | "abatizacion">("todos");
  const [loading, setLoading] = useState(true);
  const [asignacionToDelete, setAsignacionToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchHistorial();
  }, []);

  useEffect(() => {
    let result = asignaciones;

    if (filterType !== "todos") {
      result = result.filter(a => a.tipo === filterType);
    }

    if (search) {
      const lowerSearch = search.toLowerCase();
      result = result.filter(a => 
        a.lugarNombre.toLowerCase().includes(lowerSearch) ||
        a.brigadistaNombre.toLowerCase().includes(lowerSearch) ||
        (a.manzanas && a.manzanas.some(m => m.toLowerCase().includes(lowerSearch)))
      );
    }

    setFiltered(result);
  }, [search, filterType, asignaciones]);

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const data = await api.getAsignaciones(); // Reusing asignaciones endpoint as history source
      setAsignaciones(data);
      setFiltered(data);
    } catch (error) {
      console.error("Error fetching historial:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setAsignacionToDelete(id);
  };

  const confirmDelete = async () => {
    if (asignacionToDelete) {
      setLoading(true);
      await api.deleteAsignacion(asignacionToDelete);
      await fetchHistorial();
      setAsignacionToDelete(null);
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setAsignacionToDelete(null);
  };

  return (
    <View style={tw`flex-1`}>
      <View style={tw`flex-row justify-between items-center mb-6`}>
        <Text style={tw`text-2xl font-bold text-gray-800`}>Historial</Text>
        <Text style={tw`text-sm text-gray-500`}>{filtered.length} registros</Text>
      </View>

      {/* Filtros */}
      <View style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4`}>
        <View style={tw`relative justify-center mb-3`}>
          <View style={tw`absolute left-3 z-10`}>
            <Search color="#9ca3af" size={20} />
          </View>
          <TextInput
            placeholder="Buscar..."
            value={search}
            onChangeText={setSearch}
            style={tw`w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg`}
          />
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={tw`flex-row pb-1`}>
          <TouchableOpacity
            onPress={() => setFilterType("todos")}
            style={tw`px-4 py-2 rounded-full mr-2 ${
              filterType === "todos" ? "bg-gray-800" : "bg-gray-100"
            }`}
          >
            <Text style={tw`text-sm font-medium ${filterType === "todos" ? "text-white" : "text-gray-600"}`}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterType("fumigacion")}
            style={tw`px-4 py-2 rounded-full mr-2 ${
              filterType === "fumigacion" ? "bg-blue-100" : "bg-gray-100"
            }`}
          >
            <Text style={tw`text-sm font-medium ${filterType === "fumigacion" ? "text-blue-700" : "text-gray-600"}`}>
              Fumigación
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterType("abatizacion")}
            style={tw`px-4 py-2 rounded-full mr-2 ${
              filterType === "abatizacion" ? "bg-green-100" : "bg-gray-100"
            }`}
          >
            <Text style={tw`text-sm font-medium ${filterType === "abatizacion" ? "text-green-700" : "text-gray-600"}`}>
              Abatización
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista */}
      <View style={tw`gap-3`}>
        {loading ? (
          <Text style={tw`text-center text-gray-500 py-8`}>Cargando...</Text>
        ) : filtered.length === 0 ? (
          <View style={tw`items-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200`}>
            <Filter color="#d1d5db" size={48} style={tw`mb-2`} />
            <Text style={tw`text-gray-500`}>No se encontraron registros</Text>
          </View>
        ) : (
          filtered.map((item) => (
            <View key={item.id} style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100`}>
              <View style={tw`flex-row justify-between items-start mb-2`}>
                <View>
                  <Text style={tw`font-bold text-gray-800 text-lg`}>{item.lugarNombre}</Text>
                  <Text style={tw`text-xs text-gray-500 uppercase font-semibold`}>{item.lugarType}</Text>
                </View>
                <View style={tw`px-3 py-1 rounded-full ${
                  item.tipo === 'fumigacion' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  <Text style={tw`text-xs font-bold uppercase ${
                    item.tipo === 'fumigacion' ? 'text-blue-700' : 'text-green-700'
                  }`}>
                    {item.tipo}
                  </Text>
                </View>
              </View>

              <View style={tw`flex-row flex-wrap gap-4 mb-3`}>
                <View style={tw`flex-row items-center`}>
                  <Calendar size={14} color="#9ca3af" style={tw`mr-2`} />
                  <Text style={tw`text-sm text-gray-600`}>
                    {item.fecha ? format(new Date(item.fecha), "dd MMM yyyy", { locale: es }) : "N/A"}
                  </Text>
                </View>
                <View style={tw`flex-row items-center`}>
                  <MapPin size={14} color="#9ca3af" style={tw`mr-2`} />
                  <Text style={tw`text-sm text-gray-600`}>
                    {item.manzanas?.length > 0 ? `${item.manzanas.length} manzanas` : "General"}
                  </Text>
                </View>
              </View>

              {item.manzanas?.length > 0 && (
                <View style={tw`bg-gray-50 p-2 rounded-lg mb-3`}>
                  <Text style={tw`text-xs text-gray-500 font-medium mb-1`}>Manzanas:</Text>
                  <View style={tw`flex-row flex-wrap gap-1`}>
                    {item.manzanas.map((m, idx) => (
                      <View key={idx} style={tw`bg-white border border-gray-200 px-2 py-0.5 rounded`}>
                        <Text style={tw`text-xs text-gray-600`}>{m}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={tw`flex-row justify-between items-center pt-3 border-t border-gray-50`}>
                <Text style={tw`text-sm text-gray-500`}>
                  Brigadista: <Text style={tw`font-medium text-gray-700`}>{item.brigadistaNombre}</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id)}
                  style={tw`bg-red-50 p-2 rounded-lg border border-red-100`}
                >
                  <Trash2 size={16} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Delete Confirmation Modal */}
      {asignacionToDelete && (
        <View style={tw`absolute inset-0 bg-black/50 flex items-center justify-center z-50`}>
          <View style={tw`bg-white p-6 rounded-xl shadow-xl w-80 max-w-[90%]`}>
            <Text style={tw`text-xl font-bold text-gray-800 mb-2`}>Eliminar Asignación</Text>
            <Text style={tw`text-gray-600 mb-6`}>¿Estás seguro de que deseas eliminar esta asignación? Esta acción no se puede deshacer.</Text>
            <View style={tw`flex-row justify-end gap-3`}>
              <TouchableOpacity 
                onPress={cancelDelete}
                style={tw`px-4 py-2 rounded-lg bg-gray-100`}
              >
                <Text style={tw`text-gray-700 font-medium`}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={confirmDelete}
                style={tw`px-4 py-2 rounded-lg bg-red-600`}
              >
                <Text style={tw`text-white font-medium`}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
