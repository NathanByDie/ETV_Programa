import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Stage, Layer, Line, Rect, Text as KonvaText, Group, Circle } from "react-konva";
import { format, subDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle, Map as MapIcon, Target } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";

interface Brigadista {
  id: string;
  nombre: string;
}

interface CroquisElement {
  id: string;
  type: 'street' | 'manzana' | 'vivienda' | 'barrio' | 'reference';
  points?: number[];
  x?: number;
  y?: number;
  data: {
    label?: string;
    blockNumber?: string;
    houseCount?: string;
    inhabitants?: string;
  };
}

interface CroquisData {
  id: string;
  nombre: string;
  elements: CroquisElement[];
}

const CustomPicker = ({ selectedValue, onValueChange, items, placeholder }: any) => {
  if (Platform.OS === 'web') {
    return (
      <select
        value={selectedValue}
        onChange={(e) => onValueChange(e.target.value)}
        style={{
          width: '100%',
          height: '50px',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '0 12px',
          fontSize: '16px',
          color: '#374151',
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
        }}
      >
        <option value="" disabled>{placeholder}</option>
        {items.map((item: any) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    );
  }

  return (
    <Picker
      selectedValue={selectedValue}
      onValueChange={onValueChange}
      style={{ width: '100%', height: 50, backgroundColor: 'transparent' }}
    >
      <Picker.Item label={placeholder} value="" />
      {items.map((item: any) => (
        <Picker.Item key={item.value} label={item.label} value={item.value} />
      ))}
    </Picker>
  );
};

export default function Asignacion() {
  const [tipo, setTipo] = useState<"fumigacion" | "abatizacion">("fumigacion");
  const [lugarType, setLugarType] = useState<"barrio" | "comarca">("barrio");
  const [lugarNombre, setLugarNombre] = useState("");
  const [manzanas, setManzanas] = useState(""); 
  const [brigadistaId, setBrigadistaId] = useState("");
  const [brigadistas, setBrigadistas] = useState<Brigadista[]>([]);
  
  const [allCroquis, setAllCroquis] = useState<CroquisData[]>([]);
  const [selectedCroquisId, setSelectedCroquisId] = useState("");
  const [selectedBarrioId, setSelectedBarrioId] = useState("");
  const [availableBarrios, setAvailableBarrios] = useState<CroquisElement[]>([]);
  const [availableManzanas, setAvailableManzanas] = useState<CroquisElement[]>([]);
  const [selectedManzanas, setSelectedManzanas] = useState<string[]>([]);

  const [modoFoco, setModoFoco] = useState(false);
  const [focoPoint, setFocoPoint] = useState<{x: number, y: number} | null>(null);

  const [loading, setLoading] = useState(false);
  const [validationMsg, setValidationMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const [previewScale, setPreviewScale] = useState(0.5);
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
  const previewStageRef = useRef<any>(null);

  // Centroid calculation for polygons
  const getCentroid = (points: number[]) => {
    if (!points || points.length < 6) return { x: points[0] || 0, y: points[1] || 0 };
    
    let area = 0;
    let cx = 0;
    let cy = 0;
    
    for (let i = 0; i < points.length; i += 2) {
      const x1 = points[i];
      const y1 = points[i + 1];
      const x2 = points[(i + 2) % points.length];
      const y2 = points[(i + 3) % points.length];
      
      const factor = (x1 * y2 - x2 * y1);
      area += factor;
      cx += (x1 + x2) * factor;
      cy += (y1 + y2) * factor;
    }
    
    area /= 2;
    if (area === 0) return { x: points[0], y: points[1] };
    
    cx = cx / (6 * area);
    cy = cy / (6 * area);
    
    return { x: cx, y: cy };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bData, cData] = await Promise.all([
          api.getBrigadistas(),
          api.getAllCroquis()
        ]);
        setBrigadistas(bData);
        setAllCroquis(cData);
      } catch (e) {
        console.warn("Error fetching data", e);
      }
    };
    fetchData();
  }, []);

  // Helper: Ray Casting algorithm
  const isPointInPolygon = (x: number, y: number, polyPoints: number[]) => {
    let inside = false;
    for (let i = 0, j = polyPoints.length - 2; i < polyPoints.length; j = i, i += 2) {
      const xi = polyPoints[i], yi = polyPoints[i + 1];
      const xj = polyPoints[j], yj = polyPoints[j + 1];
      
      const intersect = ((yi > y) !== (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const getReferenceForManzana = (manzana: any, croquisElements: any[]) => {
    if (!manzana.points) return "";
    const refs = croquisElements.filter(el => el.type === 'reference' && el.x && el.y);
    const refInside = refs.find(r => isPointInPolygon(r.x!, r.y!, manzana.points!));
    return refInside ? (refInside.data.label || "Ref") : "";
  };

  // Update barrios when croquis changes
  useEffect(() => {
    if (selectedCroquisId) {
      const croquis = allCroquis.find(c => c.id === selectedCroquisId);
      if (croquis) {
        const barrios = croquis.elements.filter(el => el.type === 'barrio');
        setAvailableBarrios(barrios);
        setSelectedBarrioId("");
        setAvailableManzanas([]);
        setSelectedManzanas([]);
      }
    } else {
      setAvailableBarrios([]);
      setSelectedBarrioId("");
    }
  }, [selectedCroquisId, allCroquis]);

  // Update manzanas when barrio changes
  useEffect(() => {
    setFocoPoint(null);
    setModoFoco(false);

    if (selectedBarrioId && selectedCroquisId) {
      const croquis = allCroquis.find(c => c.id === selectedCroquisId);
      const barrio = availableBarrios.find(b => b.id === selectedBarrioId);
      
      if (croquis && barrio && barrio.points) {
        setLugarNombre(barrio.data.label || "Barrio sin nombre");
        
        // Find manzanas inside this barrio
        const manzanasInBarrio = croquis.elements.filter(el => 
          el.type === 'manzana' && el.points && el.points.length >= 6 && (
            // Check if any point of the manzana is inside the barrio
            isPointInPolygon(el.points[0], el.points[1], barrio.points!)
          )
        );
        setAvailableManzanas(manzanasInBarrio);
        // By default select all manzanas in the barrio
        setSelectedManzanas(manzanasInBarrio.map(m => m.data.blockNumber || m.id));

        // Auto-fit preview map to barrio bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < barrio.points.length; i += 2) {
          minX = Math.min(minX, barrio.points[i]);
          maxX = Math.max(maxX, barrio.points[i]);
          minY = Math.min(minY, barrio.points[i+1]);
          maxY = Math.max(maxY, barrio.points[i+1]);
        }
        
        const padding = 40;
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Preview container is approx 300x180 (or full width on mobile)
        // Let's assume a container width of 300 and height of 180 for scale calculation
        const scaleX = 300 / (width + padding * 2);
        const scaleY = 180 / (height + padding * 2);
        const scale = Math.min(scaleX, scaleY);
        
        setPreviewScale(scale);
        setPreviewPos({
          x: -(minX - padding) * scale,
          y: -(minY - padding) * scale
        });
      }
    } else {
      setAvailableManzanas([]);
      setSelectedManzanas([]);
    }
  }, [selectedBarrioId]);

  useEffect(() => {
    setManzanas(selectedManzanas.join(", "));
  }, [selectedManzanas]);

  useEffect(() => {
    setValidationMsg(null);
  }, [tipo, lugarNombre, manzanas]);

  const toggleManzana = (id: string) => {
    setSelectedManzanas(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleMapClick = (e: any) => {
    if (!modoFoco) return;
    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;
    
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    const pos = transform.point(pointerPosition);
    
    setFocoPoint(pos);
    
    // 500m radius in our scale (10px = 1m)
    const radius = 5000; 
    
    // Auto-select manzanas inside the 500m radius
    const newSelected: string[] = [];
    availableManzanas.forEach(m => {
      if (m.points && m.points.length >= 2) {
        let inside = false;
        // Check if any point of the manzana is within the 500m radius
        for(let i=0; i<m.points.length; i+=2) {
           const dx = m.points[i] - pos.x;
           const dy = m.points[i+1] - pos.y;
           if (Math.sqrt(dx*dx + dy*dy) <= radius) {
             inside = true;
             break;
           }
        }
        if (inside) {
          newSelected.push(m.data.blockNumber || m.id.split('-').pop()!);
        }
      }
    });
    setSelectedManzanas(newSelected);
  };

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

      // Print document
      if (Platform.OS === 'web') {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const brigadistaName = brigadistas.find(b => b.id === brigadistaId)?.nombre || 'Desconocido';
          const date = format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
          
          let mapImage = '';
          if (previewStageRef.current) {
            mapImage = previewStageRef.current.toDataURL({ pixelRatio: 2 });
          }

          const croquisElements = allCroquis.find(c => c.id === selectedCroquisId)?.elements || [];
          const selectedManzanasData = availableManzanas.filter(m => selectedManzanas.includes(m.data.blockNumber || m.id.split('-').pop()!));
          
          let tableRows = '';
          let totalViviendas = 0;
          let totalHabitantes = 0;

          selectedManzanasData.forEach((m, index) => {
            const label = m.data.blockNumber || m.id.split('-').pop();
            const ref = getReferenceForManzana(m, croquisElements);
            const viviendas = parseInt(m.data.houseCount || '0', 10);
            const habitantes = parseInt(m.data.inhabitants || '0', 10);
            totalViviendas += isNaN(viviendas) ? 0 : viviendas;
            totalHabitantes += isNaN(habitantes) ? 0 : habitantes;

            tableRows += `
              <tr>
                ${index === 0 ? `<td rowspan="${selectedManzanasData.length}" style="font-weight: bold; vertical-align: middle;">Trabajo No 1</td>` : ''}
                <td style="text-align: center; font-weight: bold;">${label}</td>
                <td style="text-align: center;">${isNaN(viviendas) ? '' : viviendas}</td>
                <td style="text-align: center;">${isNaN(habitantes) ? '' : habitantes}</td>
                <td></td>
                <td>${ref}</td>
              </tr>
            `;
          });

          printWindow.document.write(`
            <html>
              <head>
                <title>Consolidado Diario - ${tipo.toUpperCase()}</title>
                <style>
                  body { font-family: 'Arial', sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; font-size: 11px; }
                  .header { text-align: center; margin-bottom: 20px; position: relative; }
                  .header h2, .header h3, .header h4 { margin: 2px 0; }
                  .date-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 10px; }
                  
                  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                  th, td { border: 1px solid #000; padding: 4px 8px; }
                  th { background-color: #93c5fd; font-weight: bold; text-align: center; }
                  .table-header-blue { background-color: #93c5fd; font-weight: bold; text-align: center; }
                  .table-total { background-color: #fbbf24; font-weight: bold; }
                  
                  .map-container { border: 3px solid #000; padding: 5px; margin-bottom: 15px; text-align: center; height: 250px; display: flex; align-items: center; justify-content: center; }
                  .map-image { max-width: 100%; max-height: 100%; object-fit: contain; }
                  
                  .activities-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-bottom: 20px; border: 1px solid #000; }
                  .activities-col { border-right: 1px solid #000; }
                  .activities-col:last-child { border-right: none; }
                  .activity-row { display: flex; border-bottom: 1px solid #000; }
                  .activity-row:last-child { border-bottom: none; }
                  .activity-label { flex: 1; padding: 4px 8px; font-weight: bold; font-size: 10px; }
                  .activity-value { width: 40px; border-left: 1px solid #000; }
                  .activity-header { font-weight: bold; text-align: left; padding: 4px 8px; border-bottom: 1px solid #000; font-size: 10px; }
                  
                  .form-row { margin-bottom: 10px; display: flex; align-items: flex-end; }
                  .form-label { font-weight: bold; margin-right: 5px; white-space: nowrap; }
                  .form-line { flex: 1; border-bottom: 1px solid #000; height: 15px; }
                  
                  .signature-section { margin-top: 30px; }
                  .signature-line { border-bottom: 1px solid #000; width: 100%; margin-top: 20px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h3>MINISTERIO DE SALUD</h3>
                  <h3>HOSPITAL PRIMARIO DE CAMOAPA</h3>
                  <h4>PROGRAMA DE E.T.V</h4>
                  <div class="date-row">
                    <span>Consolidado Diario</span>
                    <span>Fecha: ${date}</span>
                  </div>
                </div>
                
                <table>
                  <tr>
                    <td colspan="6" class="table-header-blue">PROGRAMA E.T.V CAMOAPA-BOACO</td>
                  </tr>
                  <tr>
                    <td colspan="6" class="table-header-blue">RELACION POR MANZANA</td>
                  </tr>
                  <tr>
                    <td colspan="6" class="table-header-blue">BARRIO: ${lugarNombre.toUpperCase()}</td>
                  </tr>
                  <tr>
                    <th style="background-color: transparent;"></th>
                    <th style="background-color: transparent;">Manz<br>No</th>
                    <th style="background-color: transparent;">vivienda<br>Existentes</th>
                    <th style="background-color: transparent;">No<br>Habitantes</th>
                    <th style="background-color: transparent;">Casas<br>Nuevas</th>
                    <th style="background-color: transparent;">Punto de Referencia</th>
                  </tr>
                  ${tableRows}
                  <tr class="table-total">
                    <td>TOTAL</td>
                    <td style="text-align: center;">${selectedManzanasData.length}</td>
                    <td style="text-align: center;">${totalViviendas || ''}</td>
                    <td style="text-align: center;">${totalHabitantes || ''}</td>
                    <td></td>
                    <td></td>
                  </tr>
                </table>

                ${mapImage ? `
                <div class="map-container">
                  <img src="${mapImage}" class="map-image" />
                </div>
                ` : '<div class="map-container"><p>Sin mapa</p></div>'}

                <div class="activities-grid">
                  <div class="activities-col">
                    <div class="activity-header">ACTIVIDAD DE FUMIGACION</div>
                    <div class="activity-row"><div class="activity-label">Viviendas Fumigadas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Viviendas Cerradas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Viviendas Renuentes</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Viviendas Deshabitada</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Manzanas Fumigadas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Habitantes Protegidos</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Puntos Claves Fumigados</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Cipermetrina Gastada</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">&nbsp;</div><div class="activity-value"></div></div>
                  </div>
                  <div class="activities-col">
                    <div class="activity-header">ACTIVIDAD DE APLICACION</div>
                    <div class="activity-row"><div class="activity-label">Viviendas Inspeccionadas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Viviendas Tratadas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Viviendas Positivas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Viviendas Cerradas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Viviendas Desabitadas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Viviendas Renuentes</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Total de Viviendas Visitadas</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Puntos clave Tratados</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">&nbsp;</div><div class="activity-value"></div></div>
                  </div>
                  <div class="activities-col">
                    <div class="activity-header">DEPOSITOS</div>
                    <div class="activity-row"><div class="activity-label">Depósitos Eliminados</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Depósitos Cepillados</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Depósitos Tratados</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Depósitos Inspeccionados</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Depósitos Positivos</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">Abate en Kg Utilizado</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">&nbsp;</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">&nbsp;</div><div class="activity-value"></div></div>
                    <div class="activity-row"><div class="activity-label">&nbsp;</div><div class="activity-value"></div></div>
                  </div>
                </div>

                <div class="form-row">
                  <span class="form-label">Nombres y Apellidos del Caso Sospechoso</span>
                  <div class="form-line"></div>
                </div>
                <div class="form-row">
                  <span class="form-label">Jefe de Familia del Caso Sospechoso</span>
                  <div class="form-line"></div>
                </div>
                <div class="form-row">
                  <span class="form-label">Fecha de Nacimiento</span>
                  <div class="form-line" style="flex: 0.5;"></div>
                  <span class="form-label" style="margin-left: 10px;">Edad</span>
                  <div class="form-line" style="flex: 0.2;"></div>
                  <span class="form-label" style="margin-left: 10px;">Sexo</span>
                  <div class="form-line" style="flex: 0.2;"></div>
                  <span class="form-label" style="margin-left: 10px;">Barrio O Comunidad</span>
                  <div class="form-line"></div>
                </div>
                <div class="form-row">
                  <span class="form-label">Dirección</span>
                  <div class="form-line"></div>
                </div>
                <div class="form-row">
                  <span class="form-label">Observacion</span>
                  <div class="form-line"></div>
                </div>
                <div class="form-row">
                  <div class="form-line"></div>
                </div>

                <div class="signature-section">
                  <span class="form-label">Nombre / Apellido y Firma de Recursos Participantes: </span>
                  <span style="font-weight: bold;">${brigadistaName}</span>
                  <div class="signature-line"></div>
                </div>

                <script>
                  window.onload = function() { window.print(); }
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      }

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
            <CustomPicker
              selectedValue={brigadistaId}
              onValueChange={setBrigadistaId}
              placeholder="Seleccionar brigadista..."
              items={brigadistas.map(b => ({ label: b.nombre, value: b.id }))}
            />
          </View>
        </View>

        {/* Croquis Selection */}
        <View style={tw`mb-4`}>
          <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Seleccionar Croquis</Text>
          <View style={tw`border border-gray-300 rounded-lg bg-gray-50 overflow-hidden`}>
            <CustomPicker
              selectedValue={selectedCroquisId}
              onValueChange={setSelectedCroquisId}
              placeholder="Seleccionar un croquis..."
              items={allCroquis.map(c => ({ label: c.nombre, value: c.id }))}
            />
          </View>
        </View>

        {/* Barrio Selection */}
        {selectedCroquisId !== "" && (
          <View style={tw`mb-4`}>
            <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Seleccionar Barrio</Text>
            <View style={tw`border border-gray-300 rounded-lg bg-gray-50 overflow-hidden`}>
              <CustomPicker
                selectedValue={selectedBarrioId}
                onValueChange={setSelectedBarrioId}
                placeholder="Seleccionar un barrio..."
                items={availableBarrios.map(b => ({ label: b.data.label || "Sin nombre", value: b.id }))}
              />
            </View>
          </View>
        )}

        {/* Manzanas Preview & Selection */}
        {selectedBarrioId !== "" && availableManzanas.length > 0 && (
          <View style={tw`mb-6`}>
            <View style={tw`flex-row items-center justify-between mb-2`}>
              <Text style={tw`text-sm font-medium text-gray-700`}>Seleccionar Manzanas del Barrio</Text>
              <TouchableOpacity 
                onPress={() => {
                  setModoFoco(!modoFoco);
                  if (modoFoco) {
                    setFocoPoint(null);
                  }
                }}
                style={tw`flex-row items-center px-3 py-1.5 rounded-full border ${modoFoco ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}
              >
                <Target size={14} color={modoFoco ? "#ef4444" : "#6b7280"} style={tw`mr-1`} />
                <Text style={tw`text-xs font-medium ${modoFoco ? 'text-red-600' : 'text-gray-600'}`}>
                  Operativo Foco (500m)
                </Text>
              </TouchableOpacity>
            </View>

            {modoFoco && !focoPoint && (
              <Text style={tw`text-xs text-red-500 mb-2 italic`}>
                Toca en el mapa para marcar la casa con el caso positivo.
              </Text>
            )}

            <View style={tw`flex-row flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200`}>
              {availableManzanas.map((m) => {
                const label = m.data.blockNumber || m.id.split('-').pop();
                const isSelected = selectedManzanas.includes(label!);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => toggleManzana(label!)}
                    style={tw`px-3 py-2 rounded-lg border ${
                      isSelected ? 'bg-blue-600 border-blue-700' : 'bg-white border-gray-300'
                    }`}
                  >
                    <Text style={tw`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                      M-{label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Visual Preview (Mini Map) & Table */}
            <View style={tw`mt-4 flex-col md:flex-row gap-4`}>
              {/* Table */}
              <View style={tw`flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden`}>
                <View style={tw`bg-gray-100 px-4 py-2 border-b border-gray-200 flex-row`}>
                  <Text style={tw`font-bold text-gray-700 flex-1`}>Manzana</Text>
                  <Text style={tw`font-bold text-gray-700 flex-2`}>Punto Clave</Text>
                </View>
                <ScrollView style={tw`max-h-48`}>
                  {availableManzanas.filter(m => selectedManzanas.includes(m.data.blockNumber || m.id.split('-').pop()!)).map((m, index) => {
                    const label = m.data.blockNumber || m.id.split('-').pop();
                    const croquisElements = allCroquis.find(c => c.id === selectedCroquisId)?.elements || [];
                    const ref = getReferenceForManzana(m, croquisElements);
                    return (
                      <View key={m.id} style={tw`flex-row px-4 py-2 border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <Text style={tw`text-gray-800 font-medium flex-1`}>M-{label}</Text>
                        <Text style={tw`text-gray-600 flex-2`} numberOfLines={1}>{ref || '-'}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Map */}
              <View style={tw`flex-1 h-48 bg-gray-100 rounded-xl border border-gray-200 overflow-hidden items-center justify-center`}>
                <Stage 
                  width={300} 
                  height={180}
                  scaleX={previewScale}
                  scaleY={previewScale}
                  x={previewPos.x}
                  y={previewPos.y}
                  onMouseDown={handleMapClick}
                  onTouchStart={handleMapClick}
                  ref={previewStageRef}
                >
                  <Layer>
                    {/* Draw Barrio */}
                    {availableBarrios.find(b => b.id === selectedBarrioId)?.points && (
                      <Line
                        points={availableBarrios.find(b => b.id === selectedBarrioId)!.points!}
                        closed={true}
                        fill="rgba(59, 130, 246, 0.1)"
                        stroke="#2563eb"
                        strokeWidth={2 / previewScale}
                      />
                    )}
                    {/* Draw Manzanas */}
                    {availableManzanas.map(m => {
                      const centroid = getCentroid(m.points!);
                      return (
                        <Group key={m.id}>
                          <Line
                            points={m.points!}
                            closed={true}
                            fill={selectedManzanas.includes(m.data.blockNumber || m.id.split('-').pop()!) ? "rgba(37, 99, 235, 0.6)" : "rgba(209, 213, 219, 0.5)"}
                            stroke="#1f2937"
                            strokeWidth={2 / previewScale}
                          />
                          <KonvaText
                            x={centroid.x}
                            y={centroid.y}
                            text={m.data.blockNumber}
                            fontSize={20 / previewScale}
                            fill="#000"
                            offsetX={(10 / previewScale)} // Approximate centering
                            offsetY={(10 / previewScale)}
                          />
                        </Group>
                      );
                    })}

                    {/* Draw Foco Radius (500m) */}
                    {focoPoint && (
                      <Circle
                        x={focoPoint.x}
                        y={focoPoint.y}
                        radius={5000}
                        fill="rgba(239, 68, 68, 0.15)"
                        stroke="#ef4444"
                        strokeWidth={2 / previewScale}
                        dash={[10 / previewScale, 10 / previewScale]}
                      />
                    )}
                    {/* Draw Foco Point (Center) */}
                    {focoPoint && (
                      <Circle
                        x={focoPoint.x}
                        y={focoPoint.y}
                        radius={12 / previewScale}
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth={3 / previewScale}
                      />
                    )}
                  </Layer>
                </Stage>
              </View>
            </View>
          </View>
        )}

        {/* Manual Overrides (Hidden if using selective mode, but kept for compatibility) */}
        {selectedBarrioId === "" && (
          <View style={tw`flex-row gap-3 mb-4`}>
             <View style={tw`flex-1`}>
              <Text style={tw`text-sm font-medium text-gray-700 mb-1`}>Ubicación</Text>
              <View style={tw`border border-gray-300 rounded-lg bg-gray-50 overflow-hidden`}>
                <CustomPicker
                  selectedValue={lugarType}
                  onValueChange={setLugarType}
                  placeholder="Seleccionar tipo..."
                  items={[
                    { label: "Barrio", value: "barrio" },
                    { label: "Comarca", value: "comarca" }
                  ]}
                />
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
        )}

        {selectedBarrioId === "" && lugarType === "barrio" && (
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
