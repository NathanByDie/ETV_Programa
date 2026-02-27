import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { Stage, Layer, Line, Circle, Rect, Text as KonvaText, Group } from "react-konva";
import { Trash2, MousePointer, PenTool, Square, Circle as CircleIcon, Map as MapIcon, Save, ZoomIn, ZoomOut, Move, Undo, Redo, XCircle, MapPin } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";


type ToolType = 'select' | 'street' | 'manzana' | 'vivienda' | 'barrio' | 'pan' | 'reference';

interface Element {
  id: string;
  type: 'street' | 'manzana' | 'vivienda' | 'barrio' | 'reference';
  points?: number[]; // For lines/polygons
  x?: number; // For houses/rects/references
  y?: number;
  data: {
    label?: string;
    inhabitants?: string;
    houseCount?: string;
    streetType?: 'calle' | 'carretera' | 'camino';
    referenceType?: 'tienda' | 'escuela' | 'parque' | 'iglesia' | 'otro'; // New property
  };
  style?: {
    stroke?: string;
    fill?: string;
    strokeWidth?: number;
    opacity?: number;
  };
}

export default function Croquis() {
  const [elements, setElements] = useState<Element[]>([]);
  const [tool, setTool] = useState<ToolType>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  
  // Properties form state
  const [propLabel, setPropLabel] = useState("");
  const [propInhabitants, setPropInhabitants] = useState("");
  const [propHouseCount, setPropHouseCount] = useState("");

  const stageRef = useRef<any>(null);

  const [history, setHistory] = useState<Element[][]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  useEffect(() => {
    loadCroquis();
  }, []);

  const loadCroquis = async () => {
    try {
      const data = await api.getCroquis();
      if (data) {
        setElements(data);
      }
    } catch (e) {
      console.error("Error loading croquis:", e);
    }
  };

  const saveCroquis = async () => {
    setLoading(true);
    try {
      const success = await api.saveCroquis("Mi Croquis", elements);
      if (success) {
        alert("Croquis guardado exitosamente.");
      } else {
        alert("Error al guardar croquis.");
      }
    } catch (e) {
      console.error("Error saving croquis:", e);
      alert("Error al guardar croquis.");
    } finally {
      setLoading(false);
    }
  };

  // Save history on change
  useEffect(() => {
    if (elements.length > 0) {
      // Only add to history if it's different from the current step
      const current = JSON.stringify(elements);
      const last = historyStep >= 0 ? JSON.stringify(history[historyStep]) : "";
      
      if (current !== last) {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(elements);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
      }
    }
  }, [elements]);

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setElements(history[historyStep - 1]);
    } else if (historyStep === 0) {
      setHistoryStep(-1);
      setElements([]);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setElements(history[historyStep + 1]);
    }
  };

  const removeLastPoint = () => {
    if (currentPoints.length >= 2) {
      setCurrentPoints(currentPoints.slice(0, -2));
    }
  };

  // Función auxiliar para detectar si un punto está dentro de un polígono (Ray Casting algorithm)
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

  // Función para encontrar el punto más cercano de una calle existente (Snapping)
  const getSnapPoint = (x: number, y: number, threshold = 20) => {
    let closestPoint = { x, y };
    let minDistance = threshold;
    let snapped = false;

    elements.forEach(el => {
      if (el.type === 'street' && el.points) {
        // Check segments (lines between vertices)
        for (let i = 0; i < el.points.length - 2; i += 2) {
          const x1 = el.points[i];
          const y1 = el.points[i + 1];
          const x2 = el.points[i + 2];
          const y2 = el.points[i + 3];

          // Calculate closest point on segment
          const A = x - x1;
          const B = y - y1;
          const C = x2 - x1;
          const D = y2 - y1;

          const dot = A * C + B * D;
          const lenSq = C * C + D * D;
          let param = -1;
          if (lenSq !== 0) param = dot / lenSq;

          let xx, yy;

          if (param < 0) {
            xx = x1;
            yy = y1;
          } else if (param > 1) {
            xx = x2;
            yy = y2;
          } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
          }

          const dist = Math.sqrt(Math.pow(x - xx, 2) + Math.pow(y - yy, 2));

          if (dist < minDistance) {
            minDistance = dist;
            closestPoint = { x: xx, y: yy };
            snapped = true;
          }
        }
      }
    });

    return { point: closestPoint, snapped };
  };

  const handleStageClick = (e: any) => {
    // If clicking on empty stage and in select mode, deselect
    const clickedOnEmpty = e.target === e.target.getStage();
    if (clickedOnEmpty && tool === 'select') {
      setSelectedId(null);
      return;
    }

    const stage = e.target.getStage();
    const point = stage.getRelativePointerPosition();
    let x = point.x;
    let y = point.y;

    // Aplicar snapping si estamos dibujando una calle
    if (tool === 'street') {
      const { point: snapPoint } = getSnapPoint(x, y);
      x = snapPoint.x;
      y = snapPoint.y;
    }

    if (tool === 'street' || tool === 'manzana' || tool === 'barrio') {
      setCurrentPoints([...currentPoints, x, y]);
    } else if (tool === 'vivienda') {
      // Detectar si está dentro de una manzana
      let parentManzanaId = null;
      let houseNumber = 1;

      // Buscar si el punto cae dentro de alguna manzana existente
      const manzanas = elements.filter(el => el.type === 'manzana');
      
      // Iterar en orden inverso (las de arriba primero)
      for (let i = manzanas.length - 1; i >= 0; i--) {
        const m = manzanas[i];
        if (m.points && isPointInPolygon(x, y, m.points)) {
          parentManzanaId = m.id;
          // Contar cuántas casas hay YA en esta manzana específica
          // Esto requiere que guardemos la referencia de la manzana en la casa, 
          // o calculemos dinámicamente. Para simplicidad, calculamos dinámicamente basado en posición.
          
          // NOTA: Para un sistema robusto, deberíamos guardar 'manzanaId' en 'data' de la vivienda.
          // Aquí haremos un conteo simple de las que ya están dentro.
          const housesInThisManzana = elements.filter(el => 
            el.type === 'vivienda' && isPointInPolygon(el.x!, el.y!, m.points!)
          ).length;
          
          houseNumber = housesInThisManzana + 1;
          break; 
        }
      }

      // Si no está en ninguna manzana, usamos un contador global o reiniciamos
      if (!parentManzanaId) {
         houseNumber = elements.filter(e => e.type === 'vivienda').length + 1;
      }

      const newElement: Element = {
        id: `v-${Date.now()}`,
        type: 'vivienda',
        x,
        y,
        data: { 
          label: houseNumber.toString(),
          // Guardamos referencia a la manzana si existe (opcional, útil para futuro)
          // parentManzana: parentManzanaId 
        },
        style: { fill: '#ef4444', stroke: '#991b1b', strokeWidth: 1 }
      };
      setElements(prev => [...prev, newElement]);
      // No cambiamos a 'select' para permitir poner múltiples casas rápido
    } else if (tool === 'reference') {
      const newElement: Element = {
        id: `ref-${Date.now()}`,
        type: 'reference',
        x,
        y,
        data: { label: 'Ref', referenceType: 'otro' },
        style: { fill: '#16a34a', stroke: '#15803d', strokeWidth: 1 }
      };
      setElements(prev => [...prev, newElement]);
      setTool('select');
    }
  };

  const handleFinishDrawing = () => {
    // Si no hay suficientes puntos para una línea/polígono, no hacemos nada
    if (currentPoints.length < 4 && tool !== 'vivienda') {
      setCurrentPoints([]);
      return;
    }

    let newElement: Element | null = null;
    const id = `${tool}-${Date.now()}`;

    if (tool === 'street') {
      newElement = {
        id,
        type: 'street',
        points: [...currentPoints], // Copia profunda
        data: { label: 'Calle' },
        style: { stroke: '#4b5563', strokeWidth: 20 }
      };
    } else if (tool === 'manzana') {
      newElement = {
        id,
        type: 'manzana',
        points: [...currentPoints],
        data: { label: `M-${elements.filter(e => e.type === 'manzana').length + 1}` },
        style: { stroke: '#1f2937', strokeWidth: 2, fill: 'rgba(209, 213, 219, 0.5)' }
      };
    } else if (tool === 'barrio') {
      newElement = {
        id,
        type: 'barrio',
        points: [...currentPoints],
        data: { label: 'Barrio Nuevo' },
        style: { stroke: '#2563eb', strokeWidth: 2, fill: 'rgba(59, 130, 246, 0.1)' }
      };
    }

    if (newElement) {
      setElements(prev => [...prev, newElement!]);
    }
    setCurrentPoints([]);
    // No cambiamos a 'select' automáticamente aquí para permitir dibujo continuo si se desea,
    // o si se llama desde cambio de herramienta.
  };

  // Efecto para guardar dibujo pendiente al cambiar de herramienta
  useEffect(() => {
    if (currentPoints.length >= 4) {
       // Intentar guardar lo que se estaba dibujando antes de cambiar
       // Necesitamos saber qué herramienta ERA la activa, pero como el estado ya cambió,
       // esto es complejo. Mejor estrategia:
       // Al hacer click en una herramienta nueva, PRIMERO llamamos a finishDrawing con la herramienta ANTERIOR.
    }
    setCurrentPoints([]); // Limpiar puntos pendientes al cambiar herramienta
  }, [tool]);

  // Listen for Enter key to finish drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleFinishDrawing();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPoints, tool, elements]);

  const changeTool = (newTool: ToolType) => {
    // Si hay un dibujo en progreso con suficientes puntos, guárdalo con la herramienta ACTUAL antes de cambiar
    if (currentPoints.length >= 4) {
        handleFinishDrawing(); 
    }
    setTool(newTool);
    setCurrentPoints([]);
  };

  const updateSelectedProperty = (key: string, value: string) => {
    if (!selectedId) return;
    setElements(elements.map(el => {
      if (el.id === selectedId) {
        return { ...el, data: { ...el.data, [key]: value } };
      }
      return el;
    }));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    if (!confirm("¿Eliminar elemento seleccionado? Si es una manzana, se eliminarán también sus viviendas.")) return;

    const selectedElement = elements.find(e => e.id === selectedId);
    if (!selectedElement) return;

    let newElements = elements.filter(e => e.id !== selectedId);

    // Si eliminamos una manzana, eliminar también sus viviendas
    if (selectedElement.type === 'manzana' && selectedElement.points) {
      const housesInManzana = elements.filter(el => 
        el.type === 'vivienda' && isPointInPolygon(el.x!, el.y!, selectedElement.points!)
      );
      const houseIds = housesInManzana.map(h => h.id);
      newElements = newElements.filter(e => !houseIds.includes(e.id));
    }

    // Si eliminamos una vivienda, reordenar las restantes de la misma manzana
    if (selectedElement.type === 'vivienda') {
      // Encontrar la manzana a la que pertenecía
      const parentManzana = elements.find(m => 
        m.type === 'manzana' && m.points && isPointInPolygon(selectedElement.x!, selectedElement.y!, m.points)
      );

      if (parentManzana && parentManzana.points) {
        // Encontrar todas las viviendas que quedan en esa manzana
        const siblings = newElements.filter(el => 
          el.type === 'vivienda' && isPointInPolygon(el.x!, el.y!, parentManzana.points!)
        );

        // Ordenarlas por su etiqueta actual (asumiendo que son números)
        siblings.sort((a, b) => {
          const nA = parseInt(a.data.label || '0', 10);
          const nB = parseInt(b.data.label || '0', 10);
          return nA - nB;
        });

        // Crear mapa de actualizaciones
        const updates = new Map();
        siblings.forEach((house, index) => {
          updates.set(house.id, (index + 1).toString());
        });

        // Aplicar actualizaciones
        newElements = newElements.map(el => {
          if (updates.has(el.id)) {
            return {
              ...el,
              data: { ...el.data, label: updates.get(el.id) }
            };
          }
          return el;
        });
      }
    }

    setElements(newElements);
    setSelectedId(null);
  };

  const Tools = [
    { id: 'select', icon: MousePointer, label: 'Seleccionar' },
    { id: 'pan', icon: Move, label: 'Mover Mapa' },
    { id: 'street', icon: PenTool, label: 'Calle (Línea)' },
    { id: 'manzana', icon: Square, label: 'Manzana' },
    { id: 'vivienda', icon: CircleIcon, label: 'Vivienda' },
    { id: 'barrio', icon: MapIcon, label: 'Barrio' },
  ];

  return (
    <View style={tw`flex-1 flex-row h-full bg-gray-100`}>
      {/* Toolbar */}
      <View style={tw`w-20 bg-white border-r border-gray-200 items-center py-4 gap-2 shadow-sm z-10`}>
        {Tools.map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => changeTool(t.id as ToolType)}
            style={tw`p-2 rounded-lg items-center justify-center w-16 ${tool === t.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
          >
            <t.icon size={20} color={tool === t.id ? '#2563eb' : '#4b5563'} />
            <Text style={tw`text-[9px] text-center mt-1 text-gray-600 leading-tight`}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        
        <View style={tw`h-px w-10 bg-gray-200 my-2`} />
        
        <TouchableOpacity onPress={() => setStageScale(s => s * 1.2)} style={tw`p-2`}>
          <ZoomIn size={20} color="#4b5563" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setStageScale(s => s / 1.2)} style={tw`p-2`}>
          <ZoomOut size={20} color="#4b5563" />
        </TouchableOpacity>
        
        <View style={tw`h-px w-10 bg-gray-200 my-2`} />

        <TouchableOpacity onPress={undo} disabled={historyStep < 0} style={tw`p-2 opacity-${historyStep < 0 ? '50' : '100'}`}>
          <Undo size={20} color="#4b5563" />
        </TouchableOpacity>
        <TouchableOpacity onPress={redo} disabled={historyStep >= history.length - 1} style={tw`p-2 opacity-${historyStep >= history.length - 1 ? '50' : '100'}`}>
          <Redo size={20} color="#4b5563" />
        </TouchableOpacity>
      </View>

      {/* Canvas Area */}
      <View style={tw`flex-1 relative overflow-hidden bg-gray-50`}>
        <Stage
          width={window.innerWidth - 350} // Approx width minus sidebar
          height={window.innerHeight}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          draggable={tool === 'pan'}
          onDragEnd={(e) => setStagePos(e.target.position())}
          onMouseDown={handleStageClick}
          ref={stageRef}
          style={{ cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
        >
          <Layer>
            {/* Grid Background (Optional, simple visual guide) */}
            <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#f9fafb" />
            
            {/* Render Elements */}
            {elements.map((el) => {
              const isSelected = selectedId === el.id;
              if (el.type === 'street') {
                return (
                  <Group
                    key={el.id}
                    onClick={() => tool === 'select' && setSelectedId(el.id)}
                    onTap={() => tool === 'select' && setSelectedId(el.id)}
                  >
                    {/* Highlight when selected */}
                    {isSelected && (
                      <Line
                        points={el.points}
                        stroke="#2563eb"
                        strokeWidth={(el.style?.strokeWidth || 20) + 6}
                        lineCap="round"
                        lineJoin="round"
                        opacity={0.5}
                      />
                    )}
                    
                    {/* Road Base (Asphalt) */}
                    <Line
                      points={el.points}
                      stroke={el.style?.stroke || '#4b5563'}
                      strokeWidth={el.style?.strokeWidth || 20}
                      lineCap="round"
                      lineJoin="round"
                    />
                  </Group>
                );
              }
              if (el.type === 'manzana' || el.type === 'barrio') {
                return (
                  <Group
                    key={el.id}
                    onClick={() => tool === 'select' && setSelectedId(el.id)}
                    onTap={() => tool === 'select' && setSelectedId(el.id)}
                  >
                    <Line
                      points={el.points}
                      closed={true}
                      stroke={isSelected ? '#2563eb' : el.style?.stroke}
                      fill={el.style?.fill}
                      strokeWidth={el.style?.strokeWidth}
                    />
                    {/* Label Center Calculation (Simplified) */}
                    {el.points && el.points.length >= 2 && (
                       <KonvaText
                        x={el.points[0]}
                        y={el.points[1]}
                        text={el.data.label}
                        fontSize={12}
                        fill="#000"
                       />
                    )}
                  </Group>
                );
              }
              if (el.type === 'vivienda') {
                return (
                  <Group
                    key={el.id}
                    x={el.x}
                    y={el.y}
                    onClick={() => tool === 'select' && setSelectedId(el.id)}
                    onTap={() => tool === 'select' && setSelectedId(el.id)}
                  >
                    <Rect
                      width={12}
                      height={12}
                      offsetX={6}
                      offsetY={6}
                      fill={isSelected ? '#2563eb' : el.style?.fill}
                      stroke={el.style?.stroke}
                      strokeWidth={1}
                    />
                    <KonvaText
                      y={-18}
                      x={-5}
                      text={el.data.label}
                      fontSize={10}
                      fill="#000"
                    />
                  </Group>
                );
              }
              if (el.type === 'reference') {
                return (
                  <Group
                    key={el.id}
                    x={el.x}
                    y={el.y}
                    onClick={() => tool === 'select' && setSelectedId(el.id)}
                    onTap={() => tool === 'select' && setSelectedId(el.id)}
                  >
                    {/* Pin Shape */}
                    <Circle
                      radius={8}
                      fill={isSelected ? '#2563eb' : el.style?.fill}
                      stroke={el.style?.stroke}
                      strokeWidth={1}
                    />
                    <Circle
                      radius={3}
                      fill="#fff"
                    />
                    <KonvaText
                      y={-22}
                      x={-15}
                      width={30}
                      align="center"
                      text={el.data.label}
                      fontSize={10}
                      fill="#000"
                      fontStyle="bold"
                    />
                  </Group>
                );
              }
              return null;
            })}

            {/* Current Drawing Preview */}
            {currentPoints.length > 0 && (
              <Line
                points={currentPoints}
                stroke="#2563eb"
                strokeWidth={2}
                dash={[10, 5]}
                closed={tool === 'manzana' || tool === 'barrio'}
              />
            )}
          </Layer>
        </Stage>

        {/* Floating Action Buttons */}
        <View style={tw`absolute bottom-8 right-8 flex-row gap-4 items-end`}>
          {currentPoints.length > 0 && (
            <TouchableOpacity
              onPress={removeLastPoint}
              style={tw`bg-white p-3 rounded-full shadow-lg border border-gray-200`}
            >
              <Undo size={24} color="#dc2626" />
            </TouchableOpacity>
          )}
          
          {currentPoints.length > 0 && (
            <TouchableOpacity
              onPress={handleFinishDrawing}
              style={tw`bg-blue-600 px-6 py-3 rounded-full shadow-lg z-20`}
            >
              <Text style={tw`text-white font-bold`}>Terminar Dibujo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Properties Panel */}
      <View style={tw`w-72 bg-white border-l border-gray-200 p-4 shadow-sm z-10`}>
        <Text style={tw`text-lg font-bold text-gray-800 mb-4`}>Propiedades</Text>
        
        {selectedId ? (
          <View style={tw`gap-4`}>
            <View>
              <Text style={tw`text-xs text-gray-500 font-bold uppercase mb-1`}>Etiqueta / Nombre</Text>
              <TextInput
                value={propLabel}
                onChangeText={(t) => {
                  setPropLabel(t);
                  updateSelectedProperty('label', t);
                }}
                style={tw`border border-gray-300 rounded p-2 bg-gray-50`}
              />
            </View>

            {elements.find(e => e.id === selectedId)?.type === 'street' && (
              <View>
                <Text style={tw`text-xs text-gray-500 font-bold uppercase mb-1`}>Tipo de Vía</Text>
                <View style={tw`flex-row gap-2`}>
                  {['calle', 'carretera', 'camino'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => updateSelectedProperty('streetType', type)}
                      style={tw`px-2 py-1 rounded border ${
                        elements.find(e => e.id === selectedId)?.data.streetType === type 
                          ? 'bg-blue-100 border-blue-500' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <Text style={tw`text-xs capitalize`}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {elements.find(e => e.id === selectedId)?.type === 'reference' && (
              <View>
                <Text style={tw`text-xs text-gray-500 font-bold uppercase mb-1`}>Tipo de Referencia</Text>
                <View style={tw`flex-row flex-wrap gap-2`}>
                  {['tienda', 'escuela', 'parque', 'iglesia', 'otro'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => updateSelectedProperty('referenceType', type)}
                      style={tw`px-2 py-1 rounded border ${
                        elements.find(e => e.id === selectedId)?.data.referenceType === type 
                          ? 'bg-green-100 border-green-500' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <Text style={tw`text-xs capitalize`}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {elements.find(e => e.id === selectedId)?.type === 'manzana' && (
              <>
                <View>
                  <Text style={tw`text-xs text-gray-500 font-bold uppercase mb-1`}>Cant. Viviendas (Calc)</Text>
                  <TextInput
                    value={
                        // Calcular dinámicamente cuántas casas hay dentro de esta manzana
                        elements.filter(el => 
                            el.type === 'vivienda' && 
                            elements.find(m => m.id === selectedId)?.points &&
                            isPointInPolygon(el.x!, el.y!, elements.find(m => m.id === selectedId)!.points!)
                        ).length.toString()
                    }
                    editable={false}
                    style={tw`border border-gray-200 rounded p-2 bg-gray-100 text-gray-500`}
                  />
                  <Text style={tw`text-[10px] text-gray-400 mt-1`}>Calculado automáticamente según casas dibujadas dentro.</Text>
                </View>
                <View style={tw`mt-2`}>
                  <Text style={tw`text-xs text-gray-500 font-bold uppercase mb-1`}>Habitantes</Text>
                  <TextInput
                    value={propInhabitants}
                    onChangeText={(t) => {
                      setPropInhabitants(t);
                      updateSelectedProperty('inhabitants', t);
                    }}
                    keyboardType="numeric"
                    style={tw`border border-gray-300 rounded p-2 bg-gray-50`}
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              onPress={deleteSelected}
              style={tw`mt-4 bg-red-50 border border-red-200 p-3 rounded-lg flex-row items-center justify-center`}
            >
              <Trash2 size={18} color="#dc2626" style={tw`mr-2`} />
              <Text style={tw`text-red-700 font-medium`}>Eliminar Objeto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={tw`text-gray-400 text-center mt-10`}>
            Selecciona un objeto en el mapa para ver sus detalles.
          </Text>
        )}

        <View style={tw`mt-auto`}>
          <TouchableOpacity 
            onPress={saveCroquis}
            disabled={loading}
            style={tw`bg-green-600 py-3 rounded-lg flex-row items-center justify-center shadow-sm ${loading ? 'opacity-50' : ''}`}
          >
            <Save size={18} color="white" style={tw`mr-2`} />
            <Text style={tw`text-white font-bold`}>{loading ? "Guardando..." : "Guardar Croquis"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
