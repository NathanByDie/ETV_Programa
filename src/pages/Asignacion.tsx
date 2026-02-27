import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { format, subDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";

interface Brigadista {
  id: string;
  nombre: string;
}

export default function Asignacion() {
  const [tipo, setTipo] = useState<"fumigacion" | "abatizacion">("fumigacion");
  const [lugarType, setLugarType] = useState<"barrio" | "comarca">("barrio");
  const [lugarNombre, setLugarNombre] = useState("");
  const [manzanas, setManzanas] = useState(""); 
  const [brigadistaId, setBrigadistaId] = useState("");
  const [brigadistas, setBrigadistas] = useState<Brigadista[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationMsg, setValidationMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);

  useEffect(() => {
    const fetchBrigadistas = async () => {
      try {
        const data = await api.getBrigadistas();
        setBrigadistas(data);
      } catch (e) {
        console.warn("Error fetching brigadistas", e);
      }
    };
    fetchBrigadistas();
  }, []);

  useEffect(() => {
    setValidationMsg(null);
  }, [tipo, lugarNombre, manzanas]);

  const checkAvailability = async () => {
    if (lugarType !== "barrio" || !lugarNombre || !manzanas) return true;
    
    const manzanasList = manzanas.split(",").map(m => m.trim()).filter(Boolean);
    if (manzanasList.length === 0) return true;

    const daysLimit = tipo === "fumigacion" ? 7 : 30;
    const cutoffDate = subDays(new Date(), daysLimit);

    try {
      // Fetch all assignments and filter locally
      const allAssignments = await api.getAsignaciones();
      
      const conflicts: string[] = [];

      allAssignments.forEach((data: any) => {
        if (
          data.lugarNombre === lugarNombre &&
          data.tipo === tipo &&
          new Date(data.fecha) >= cutoffDate
        ) {
          const assignedManzanas = data.manzanas || [];
          const assignmentDate = new Date(data.fecha);
          
          const intersection = manzanasList.filter(m => assignedManzanas.includes(m));
          if (intersection.length > 0) {
            const daysAgo = differenceInDays(new Date(), assignmentDate);
            conflicts.push(`${intersection.join(", ")} (hace ${daysAgo} días)`);
          }
        }
      });

      if (conflicts.length > 0) {
        setValidationMsg({
          type: 'error',
          text: `Conflicto: Manzanas ${conflicts.join(" | ")} atendidas recientemente. Espera ${daysLimit} días.`
        });
        return false;
      } else {
        setValidationMsg({
          type: 'success',
          text: "Validación exitosa: Disponible."
        });
        return true;
      }
    } catch (e) {
      console.warn("Validation skipped", e);
      return true;
    }
  };

  const handleSubmit = async () => {
    if (!brigadistaId || !lugarNombre) {
      setValidationMsg({ type: 'error', text: "Completa todos los campos." });
      return;
    }

    setLoading(true);
    const isAvailable = await checkAvailability();
    
    if (!isAvailable) {
      setLoading(false);
      return;
    }

    try {
      await api.addAsignacion({
        tipo,
        lugarType,
        lugarNombre,
        manzanas: lugarType === "barrio" ? manzanas.split(",").map(m => m.trim()).filter(Boolean) : [],
        brigadistaId,
        brigadistaNombre: brigadistas.find(b => b.id === brigadistaId)?.nombre || "Desconocido",
        fecha: new Date().toISOString(),
        status: "pendiente"
      });
      alert("Asignación creada exitosamente");
      setLugarNombre("");
      setManzanas("");
      setBrigadistaId("");
      setValidationMsg(null);
    } catch (e) {
      console.warn("Error saving assignment:", e);
      alert("Error al guardar asignación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={tw`flex-1`}>
      <Text style={tw`text-2xl font-bold text-gray-800 mb-6`}>Nueva Asignación</Text>

      <View style={tw`bg-white p-6 rounded-xl shadow-sm border border-gray-100`}>
        
        {/* Tipo de Trabajo */}
        <View style={tw`mb-4`}>
          <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Tipo de Trabajo</Text>
          <View style={tw`flex-row gap-3`}>
            <TouchableOpacity
              onPress={() => setTipo("fumigacion")}
              style={tw`flex-1 p-3 rounded-lg border items-center ${
                tipo === "fumigacion" 
                  ? "bg-blue-50 border-blue-500" 
                  : "border-gray-200"
              }`}
            >
              <Text style={tw`font-medium ${tipo === "fumigacion" ? "text-blue-700" : "text-gray-600"}`}>
                Fumigación
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTipo("abatizacion")}
              style={tw`flex-1 p-3 rounded-lg border items-center ${
                tipo === "abatizacion" 
                  ? "bg-green-50 border-green-500" 
                  : "border-gray-200"
              }`}
            >
              <Text style={tw`font-medium ${tipo === "abatizacion" ? "text-green-700" : "text-gray-600"}`}>
                Abatización
              </Text>
            </TouchableOpacity>
          </View>
          <View style={tw`flex-row items-center mt-2`}>
            <AlertCircle size={12} color="#6b7280" style={tw`mr-1`} />
            <Text style={tw`text-xs text-gray-500`}>
              Bloqueo: {tipo === "fumigacion" ? "7 días" : "30 días"}
            </Text>
          </View>
        </View>

        {/* Brigadista */}
        <View style={tw`mb-4`}>
          <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Brigadista</Text>
          <View style={tw`border border-gray-300 rounded-lg bg-gray-50 overflow-hidden`}>
            <Picker
              selectedValue={brigadistaId}
              onValueChange={(itemValue) => setBrigadistaId(itemValue)}
              style={{ width: '100%', height: 50, backgroundColor: 'transparent' }}
            >
              <Picker.Item label="Seleccionar brigadista..." value="" />
              {brigadistas.map(b => (
                <Picker.Item key={b.id} label={b.nombre} value={b.id} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Lugar */}
        <View style={tw`flex-row gap-3 mb-4`}>
           <View style={tw`flex-1`}>
            <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Ubicación</Text>
            <View style={tw`border border-gray-300 rounded-lg bg-gray-50 overflow-hidden`}>
              <Picker
                selectedValue={lugarType}
                onValueChange={(itemValue) => setLugarType(itemValue)}
                style={{ width: '100%', height: 50, backgroundColor: 'transparent' }}
              >
                <Picker.Item label="Barrio" value="barrio" />
                <Picker.Item label="Comarca" value="comarca" />
              </Picker>
            </View>
          </View>
          <View style={tw`flex-1`}>
             <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Nombre</Text>
             <TextInput
              value={lugarNombre}
              onChangeText={setLugarNombre}
              placeholder={lugarType === "barrio" ? "Ej. San Judas" : "Ej. Las Jaguitas"}
              style={tw`w-full p-3 bg-gray-50 border border-gray-300 rounded-lg`}
            />
          </View>
        </View>

        {/* Manzanas */}
        {lugarType === "barrio" && (
          <View style={tw`mb-4`}>
            <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Manzanas</Text>
            <View style={tw`flex-row gap-2`}>
              <TextInput
                value={manzanas}
                onChangeText={setManzanas}
                placeholder="Ej. A-1, A-2, B-5"
                style={tw`flex-1 p-3 bg-gray-50 border border-gray-300 rounded-lg`}
              />
              <TouchableOpacity
                onPress={checkAvailability}
                style={tw`bg-gray-100 px-4 rounded-lg justify-center`}
              >
                <Text style={tw`text-gray-600 font-medium text-sm`}>Verificar</Text>
              </TouchableOpacity>
            </View>
            <Text style={tw`text-xs text-gray-500 mt-1`}>Separa con comas.</Text>
          </View>
        )}

        {/* Validation Msg */}
        {validationMsg && (
          <View style={tw`p-3 rounded-lg flex-row items-start ${
            validationMsg.type === 'error' ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'
          }`}>
            {validationMsg.type === 'error' 
              ? <AlertCircle size={18} color="#b91c1c" style={tw`mr-2 mt-0.5`} /> 
              : <CheckCircle size={18} color="#15803d" style={tw`mr-2 mt-0.5`} />
            }
            <Text style={tw`${validationMsg.type === 'error' ? 'text-red-700' : 'text-green-700'} flex-1`}>
              {validationMsg.text}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          style={tw`w-full bg-blue-600 py-3 rounded-xl shadow-lg mt-4 items-center`}
        >
          <Text style={tw`text-white font-bold text-base`}>
            {loading ? "Guardando..." : "Asignar Trabajo"}
          </Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}
