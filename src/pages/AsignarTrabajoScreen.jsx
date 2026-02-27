import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { barriosData } from '../data/barrios';
import tw from 'twrnc';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, addDoc, Timestamp } from 'firebase/firestore';

// Colores de la paleta Nicaragua
const COLORS = {
  primary: '#0033A0', // Azul fuerte
  secondary: '#1B998B', // Verde azulado
  accent: '#E71D36', // Rojo acento (opcional)
  background: '#F9FAFB',
  manzanaDefault: '#E5E7EB', // Gris claro
  manzanaSelected: '#10B981', // Verde fuerte
  manzanaStroke: '#9CA3AF', // Borde gris
  text: '#1F2937',
};

const AsignarTrabajoScreen = () => {
  // Estado
  const [barrioSeleccionado, setBarrioSeleccionado] = useState("Pedro Joaquin Chamorro");
  const [manzanasSeleccionadas, setManzanasSeleccionadas] = useState(new Set());
  const [scale, setScale] = useState(1);
  const [brigadistas, setBrigadistas] = useState([]);
  const [brigadistaSeleccionado, setBrigadistaSeleccionado] = useState("");

  // Obtener brigadistas de Firestore
  useEffect(() => {
    const fetchBrigadistas = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "brigadistas"));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBrigadistas(data);
      } catch (error) {
        console.warn("Error fetching brigadistas (Demo Mode): ", error);
        // Datos de ejemplo para modo demo
        setBrigadistas([
            { id: "demo1", nombre: "Juan Pérez (Demo)" },
            { id: "demo2", nombre: "Maria Lopez (Demo)" }
        ]);
      }
    };
    fetchBrigadistas();
  }, []);

  // Obtener datos del barrio actual
  const datosBarrio = useMemo(() => barriosData[barrioSeleccionado] || { viewBox: "0 0 100 100", manzanas: [] }, [barrioSeleccionado]);

  // Manejar cambio de barrio
  const handleBarrioChange = (itemValue) => {
    setBarrioSeleccionado(itemValue);
    setManzanasSeleccionadas(new Set()); // Resetear selección
  };

  // Toggle selección de manzana
  const toggleManzana = useCallback((id) => {
    setManzanasSeleccionadas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Limpiar selección
  const limpiarSeleccion = () => {
    setManzanasSeleccionadas(new Set());
    setBrigadistaSeleccionado("");
  };

  // Confirmar asignación
  const confirmarAsignacion = () => {
    if (manzanasSeleccionadas.size === 0) {
      Alert.alert("Atención", "Por favor selecciona al menos una manzana.");
      return;
    }

    if (!brigadistaSeleccionado) {
      Alert.alert("Atención", "Por favor selecciona un brigadista.");
      return;
    }

    const brigadistaNombre = brigadistas.find(b => b.id === brigadistaSeleccionado)?.nombre || "Desconocido";
    const listaManzanas = Array.from(manzanasSeleccionadas).sort((a, b) => a - b).join(", ");
    
    Alert.alert(
      "Confirmar Asignación",
      `Barrio: ${barrioSeleccionado}\nManzanas: ${listaManzanas}\nBrigadista: ${brigadistaNombre}`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Asignar", 
          onPress: async () => {
            try {
              // Intentar guardar en Firestore
              await addDoc(collection(db, "asignaciones"), {
                lugarNombre: barrioSeleccionado,
                lugarType: "barrio",
                tipo: "fumigacion",
                manzanas: Array.from(manzanasSeleccionadas).map(String),
                brigadistaId: brigadistaSeleccionado,
                brigadistaNombre: brigadistaNombre,
                fecha: Timestamp.now(),
                status: "pendiente"
              });
              Alert.alert("¡Éxito!", "Trabajo asignado al brigadista correctamente.");
            } catch (error) {
              console.warn("Error saving assignment (Demo Mode): ", error);
              // Fallback para modo demo
              Alert.alert("Modo Demo", "No se pudo guardar en la base de datos (posiblemente falta autenticación), pero la asignación se ha simulado correctamente.");
            } finally {
              limpiarSeleccion();
            }
          } 
        }
      ]
    );
  };

  return (
    <View style={tw`flex-1 bg-gray-50`}>
      {/* Header */}
      <View style={tw`bg-blue-800 p-4 pt-12 shadow-md`}>
        <Text style={tw`text-white text-xl font-bold text-center`}>Asignación de Trabajo</Text>
        <Text style={tw`text-blue-200 text-xs text-center`}>Camoapa, Nicaragua</Text>
      </View>

      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-20`}>
        {/* Selector de Barrio */}
        <View style={tw`m-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden`}>
          <Text style={tw`text-xs text-gray-500 font-bold uppercase px-4 pt-3`}>Seleccionar Barrio</Text>
          <Picker
            selectedValue={barrioSeleccionado}
            onValueChange={handleBarrioChange}
            style={{ width: '100%', height: 55 }}
          >
            {Object.keys(barriosData).map((barrio) => (
              <Picker.Item key={barrio} label={barrio} value={barrio} />
            ))}
          </Picker>
        </View>

        {/* Selector de Brigadista */}
        <View style={tw`mx-4 mb-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden`}>
          <Text style={tw`text-xs text-gray-500 font-bold uppercase px-4 pt-3`}>Seleccionar Brigadista</Text>
          <Picker
            selectedValue={brigadistaSeleccionado}
            onValueChange={(itemValue) => setBrigadistaSeleccionado(itemValue)}
            style={{ width: '100%', height: 55 }}
          >
            <Picker.Item label="Seleccione un brigadista..." value="" />
            {brigadistas.map((brigadista) => (
              <Picker.Item key={brigadista.id} label={brigadista.nombre} value={brigadista.id} />
            ))}
          </Picker>
        </View>

        {/* Mapa Interactivo (Croquis) - Placeholder for Web Compatibility */}
        <View style={tw`mx-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-80 relative items-center justify-center`}>
           <Text style={tw`text-gray-500 text-center px-4`}>
             La visualización de mapas SVG interactivos requiere configuración nativa adicional.
             {'\n\n'}
             En esta versión web, selecciona las manzanas de la lista abajo.
           </Text>
        </View>

        {/* Lista de Manzanas (Fallback for Web) */}
        <View style={tw`mx-4 mt-4`}>
            <Text style={tw`text-gray-700 font-bold mb-2`}>Seleccionar Manzanas:</Text>
            <View style={tw`flex-row flex-wrap gap-2`}>
                {datosBarrio.manzanas.map((manzana) => {
                    const isSelected = manzanasSeleccionadas.has(manzana.id);
                    return (
                        <TouchableOpacity
                            key={manzana.id}
                            onPress={() => toggleManzana(manzana.id)}
                            style={tw`w-12 h-12 rounded-lg items-center justify-center border ${
                                isSelected 
                                ? 'bg-green-500 border-green-600' 
                                : 'bg-white border-gray-300'
                            }`}
                        >
                            <Text style={tw`font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                {manzana.id}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                 {datosBarrio.manzanas.length === 0 && (
                    <Text style={tw`text-gray-400 italic`}>No hay manzanas registradas para este barrio.</Text>
                )}
            </View>
        </View>

        {/* Resumen de Selección */}
        <View style={tw`mx-4 mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100`}>
          <Text style={tw`text-blue-800 font-bold mb-1`}>
            Manzanas Seleccionadas ({manzanasSeleccionadas.size})
          </Text>
          <Text style={tw`text-gray-700 text-sm`}>
            {manzanasSeleccionadas.size > 0 
              ? Array.from(manzanasSeleccionadas).sort((a, b) => a - b).join(", ") 
              : "Ninguna seleccionada"}
          </Text>
        </View>

        {/* Botones de Acción */}
        <View style={tw`mx-4 mt-6 gap-3`}>
          <TouchableOpacity
            onPress={confirmarAsignacion}
            style={tw`bg-green-600 py-4 rounded-xl shadow-md active:bg-green-700 items-center`}
          >
            <Text style={tw`text-white font-bold text-lg`}>Asignar a Brigadista</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={limpiarSeleccion}
            style={tw`bg-white py-3 rounded-xl border border-gray-300 items-center`}
          >
            <Text style={tw`text-gray-600 font-medium`}>Limpiar Selección</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
};

export default AsignarTrabajoScreen;
