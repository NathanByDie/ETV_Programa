import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Trash2, UserPlus, AlertTriangle } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";

interface Brigadista {
  id: string;
  nombre: string;
}

export default function Brigadistas() {
  const [brigadistas, setBrigadistas] = useState<Brigadista[]>([]);
  const [newNombre, setNewNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadBrigadistas();
  }, []);

  const loadBrigadistas = async () => {
    try {
      const data = await api.getBrigadistas();
      setBrigadistas(data);
    } catch (err) {
      console.error("Error fetching brigadistas:", err);
      setError("Error al cargar brigadistas.");
    }
  };

  const handleAdd = async () => {
    if (!newNombre.trim()) return;
    setLoading(true);
    try {
      await api.addBrigadista(newNombre.trim());
      setNewNombre("");
      loadBrigadistas(); // Reload list
    } catch (error: any) {
      console.warn("Error adding document: ", error);
      setError("Error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null); // Close modal immediately

    try {
      await api.deleteBrigadista(id);
      loadBrigadistas(); // Reload list
    } catch (error) {
      console.warn("Error deleting document: ", error);
    }
  };

  return (
    <View style={tw`flex-1 relative`}>
      <Text style={tw`text-2xl font-bold text-gray-800 mb-6`}>Brigadistas</Text>
      
      {/* Custom Confirmation Banner */}
      {deletingId && (
        <View style={tw`absolute top-0 left-0 right-0 z-50 bg-red-50 border border-red-200 p-4 rounded-xl shadow-lg flex-row items-center justify-between mb-4`}>
          <View style={tw`flex-1`}>
            <Text style={tw`text-red-800 font-bold text-base`}>¿Eliminar brigadista?</Text>
            <Text style={tw`text-red-600 text-sm`}>Esta acción no se puede deshacer.</Text>
          </View>
          <View style={tw`flex-row gap-2`}>
            <TouchableOpacity 
              onPress={() => setDeletingId(null)}
              style={tw`bg-white border border-gray-300 px-3 py-2 rounded-lg`}
            >
              <Text style={tw`text-gray-700 font-medium`}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={confirmDelete}
              style={tw`bg-red-600 px-3 py-2 rounded-lg`}
            >
              <Text style={tw`text-white font-bold`}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {error && (
        <View style={tw`bg-red-100 p-3 rounded-lg mb-4 flex-row items-center`}>
          <AlertTriangle size={20} color="#b91c1c" style={tw`mr-2`} />
          <Text style={tw`text-red-700 text-sm flex-1`}>{error}</Text>
        </View>
      )}

      <View style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-row gap-2 items-center mb-6`}>
        <TextInput
          value={newNombre}
          onChangeText={setNewNombre}
          placeholder="Nombre del brigadista"
          style={tw`flex-1 px-4 py-3 border border-gray-300 rounded-lg text-base`}
        />
        <TouchableOpacity 
          onPress={handleAdd}
          disabled={loading}
          style={tw`bg-blue-600 p-3 rounded-lg items-center justify-center`}
        >
          <UserPlus size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={tw`gap-3`}>
        {brigadistas.length === 0 && !error ? (
          <Text style={tw`text-center text-gray-500 py-8`}>No hay brigadistas registrados.</Text>
        ) : (
          brigadistas.map((brigadista) => (
            <View key={brigadista.id} style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-row justify-between items-center`}>
              <Text style={tw`font-medium text-gray-700 text-base`}>{brigadista.nombre}</Text>
              <TouchableOpacity 
                onPress={() => setDeletingId(brigadista.id)}
                style={tw`p-2`}
              >
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
