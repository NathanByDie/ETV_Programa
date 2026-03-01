import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { Stage, Layer, Line, Circle, Rect, Text as KonvaText, Group } from "react-konva";
import { Trash2, MousePointer, PenTool, Square, Circle as CircleIcon, Map as MapIcon, Save, ZoomIn, ZoomOut, Move, Undo, Redo, XCircle, MapPin, Plus, Edit2, ChevronLeft } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";
import { useUnsavedChanges } from "../contexts/UnsavedChangesContext";


type ToolType = 'select' | 'street' | 'manzana' | 'vivienda' | 'barrio' | 'pan' | 'reference';

interface Element {
  id: string;
  type: 'street' | 'manzana' | 'vivienda' | 'barrio' | 'reference';
  points?: number[]; // For lines/polygons
  x?: number; // For houses/rects/references
  y?: number;
  data: {
    label?: string;
    blockNumber?: string; // New: Manual block number
    inhabitants?: string;
    houseCount?: string;
    streetType?: 'calle' | 'carretera' | 'camino';
    referenceType?: 'tienda' | 'escuela' | 'parque' | 'iglesia' | 'otro';
  };
  style?: {
    stroke?: string;
    fill?: string;
    strokeWidth?: number;
    opacity?: number;
  };
}

export default function Croquis() {
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
  const [croquisList, setCroquisList] = useState<any[]>([]);
  const [currentCroquisId, setCurrentCroquisId] = useState<string | null>(null);
  const [currentCroquisName, setCurrentCroquisName] = useState("Nuevo Croquis");
  const [croquisToDelete, setCroquisToDelete] = useState<string | null>(null);
  const [croquisToRename, setCroquisToRename] = useState<{id: string, name: string} | null>(null);

  const [elements, setElements] = useState<Element[]>([]);
  const [tool, setTool] = useState<ToolType>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  
  // Properties form state
  const [propLabel, setPropLabel] = useState("");
  const [propBlockNumber, setPropBlockNumber] = useState(""); // New
  const [propInhabitants, setPropInhabitants] = useState("");
  const [propHouseCount, setPropHouseCount] = useState("");

  const [stageDimensions, setStageDimensions] = useState({ width: 800, height: 600 });

  const stageRef = useRef<any>(null);
  const previousToolRef = useRef<ToolType>('select');
  const isSpacePressedRef = useRef(false);

  const [history, setHistory] = useState<Element[][]>([]);
  const [historyStep, setHistoryStep] = useState(-1);

  useEffect(() => {
    if (viewMode === 'list') {
      loadCroquisList();
    }
  }, [viewMode]);

  const loadCroquisList = async () => {
    setLoading(true);
    try {
      const data = await api.getAllCroquis();
      setCroquisList(data || []);
    } catch (e) {
      console.error("Error loading croquis list:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setCurrentCroquisId(null);
    setCurrentCroquisName("Nuevo Croquis");
    setElements([]);
    setHistory([]);
    setHistoryStep(-1);
    setViewMode('edit');
    setHasUnsavedChanges(false);
  };

  const handleEdit = (croquis: any) => {
    setCurrentCroquisId(croquis.id);
    setCurrentCroquisName(croquis.nombre);
    setElements(croquis.elements || []);
    setHistory([croquis.elements || []]);
    setHistoryStep(0);
    setViewMode('edit');
    setHasUnsavedChanges(false);
  };

  const handleDelete = async (id: string) => {
    setCroquisToDelete(id);
  };

  const confirmDelete = async () => {
    if (croquisToDelete) {
      setLoading(true);
      await api.deleteCroquis(croquisToDelete);
      await loadCroquisList();
      setCroquisToDelete(null);
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setCroquisToDelete(null);
  };

  const handleRename = (croquis: any) => {
    setCroquisToRename({ id: croquis.id, name: croquis.nombre });
  };

  const confirmRename = async () => {
    if (croquisToRename && croquisToRename.name.trim()) {
      setLoading(true);
      await api.renameCroquis(croquisToRename.id, croquisToRename.name.trim());
      await loadCroquisList();
      setCroquisToRename(null);
      setLoading(false);
    }
  };

  const cancelRename = () => {
    setCroquisToRename(null);
  };

  useEffect(() => {
    if (viewMode !== 'edit') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        isSpacePressedRef.current = true;
        setTool(prev => {
          if (prev !== 'pan') {
            previousToolRef.current = prev;
          }
          return 'pan';
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        isSpacePressedRef.current = false;
        setTool(previousToolRef.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [viewMode]);

  const onLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setStageDimensions({ width, height });
  };

  // Update form state when selection changes
  useEffect(() => {
    if (selectedId) {
      const el = elements.find(e => e.id === selectedId);
      if (el) {
        setPropLabel(el.data.label || "");
        setPropBlockNumber(el.data.blockNumber || "");
        setPropInhabitants(el.data.inhabitants || "");
      }
    }
  }, [selectedId]);

  const saveCroquis = async () => {
    if (!currentCroquisName.trim()) {
      alert("Por favor, ingresa un nombre para el croquis.");
      return;
    }
    setLoading(true);
    try {
      const success = await api.saveCroquis(currentCroquisName, elements, currentCroquisId || undefined);
      if (success) {
        alert("Croquis guardado exitosamente.");
        setHasUnsavedChanges(false);
        // Do not redirect to list, let user continue editing
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
      
      const common = x1 * y2 - x2 * y1;
      area += common;
      cx += (x1 + x2) * common;
      cy += (y1 + y2) * common;
    }
    
    area /= 2;
    if (area === 0) return { x: points[0], y: points[1] };
    
    return {
      x: cx / (6 * area),
      y: cy / (6 * area)
    };
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
        setHasUnsavedChanges(true);
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

  const isManzanaInAnyBarrio = (manzanaEl: Element) => {
    if (!manzanaEl.points || manzanaEl.points.length < 2) return false;
    const x = manzanaEl.points[0];
    const y = manzanaEl.points[1];
    
    return elements.some(el => 
      el.type === 'barrio' && 
      el.points && 
      isPointInPolygon(x, y, el.points)
    );
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
          const housesInThisManzana = elements.filter(el => 
            el.type === 'vivienda' && isPointInPolygon(el.x!, el.y!, m.points!)
          ).length;
          
          houseNumber = housesInThisManzana + 1;
          break; 
        }
      }

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
        },
        style: { fill: '#ef4444', stroke: '#991b1b', strokeWidth: 1 }
      };
      setElements(prev => [...prev, newElement]);
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
        points: [...currentPoints],
        data: { label: 'Calle' },
        style: { stroke: '#4b5563', strokeWidth: 20 }
      };
    } else if (tool === 'manzana') {
      const nextNum = elements.filter(e => e.type === 'manzana').length + 1;
      newElement = {
        id,
        type: 'manzana',
        points: [...currentPoints],
        data: { 
          label: `Manzana`,
          blockNumber: nextNum.toString()
        },
        style: { stroke: '#1f2937', strokeWidth: 2, fill: 'rgba(209, 213, 219, 0.5)' }
      };
    } else if (tool === 'barrio') {
      newElement = {
        id,
        type: 'barrio',
        points: [...currentPoints],
        data: { label: 'Barrio Nuevo' },
        style: { stroke: '#0284c7', strokeWidth: 2, fill: 'rgba(220, 240, 250, 0.5)' }
      };
    }

    if (newElement) {
      setElements(prev => [...prev, newElement!]);
    }
    setCurrentPoints([]);
  };

  // Efecto para guardar dibujo pendiente al cambiar de herramienta
  useEffect(() => {
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
    setHasUnsavedChanges(true);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    
    setConfirmDialog({
      visible: true,
      title: 'Eliminar Objeto',
      message: '¿Eliminar elemento seleccionado? Si es una manzana, se eliminarán también sus viviendas.',
      onConfirm: () => {
        const selectedElement = elements.find(e => e.id === selectedId);
        if (!selectedElement) return;

        let newElements = elements.filter(e => e.id !== selectedId);

        if (selectedElement.type === 'manzana' && selectedElement.points) {
          const housesInManzana = elements.filter(el => 
            el.type === 'vivienda' && isPointInPolygon(el.x!, el.y!, selectedElement.points!)
          );
          const houseIds = housesInManzana.map(h => h.id);
          newElements = newElements.filter(e => !houseIds.includes(e.id));
        }

        if (selectedElement.type === 'vivienda') {
          const parentManzana = elements.find(m => 
            m.type === 'manzana' && m.points && isPointInPolygon(selectedElement.x!, selectedElement.y!, m.points)
          );

          if (parentManzana && parentManzana.points) {
            const siblings = newElements.filter(el => 
              el.type === 'vivienda' && isPointInPolygon(el.x!, el.y!, parentManzana.points!)
            );

            siblings.sort((a, b) => {
              const nA = parseInt(a.data.label || '0', 10);
              const nB = parseInt(b.data.label || '0', 10);
              return nA - nB;
            });

            const updates = new Map();
            siblings.forEach((house, index) => {
              updates.set(house.id, (index + 1).toString());
            });

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
        setHasUnsavedChanges(true);
      }
    });
  };

  const Tools = [
    { id: 'select', icon: MousePointer, label: 'Seleccionar' },
    { id: 'pan', icon: Move, label: 'Mover Mapa' },
    { id: 'street', icon: PenTool, label: 'Calle (Línea)' },
    { id: 'manzana', icon: Square, label: 'Manzana' },
    { id: 'vivienda', icon: CircleIcon, label: 'Vivienda' },
    { id: 'barrio', icon: MapIcon, label: 'Barrio' },
    { id: 'reference', icon: MapPin, label: 'Punto de Ref' },
  ];

  if (viewMode === 'list') {
    return (
      <View style={tw`flex-1 bg-gray-50 p-6`}>
        <View style={tw`flex-row justify-between items-center mb-6`}>
          <Text style={tw`text-2xl font-bold text-gray-800`}>Mis Croquis</Text>
          <TouchableOpacity
            onPress={handleCreateNew}
            style={tw`bg-[#dcf0fa] px-4 py-2 rounded-lg flex-row items-center shadow-sm`}
          >
            <Plus size={20} color="#1e3a8a" style={tw`mr-2`} />
            <Text style={tw`text-blue-900 font-bold`}>Crear Nuevo</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <Text style={tw`text-center text-gray-500 mt-10`}>Cargando croquis...</Text>
        ) : croquisList.length === 0 ? (
          <View style={tw`bg-white p-8 rounded-xl items-center shadow-sm border border-gray-100 mt-10`}>
            <MapIcon size={48} color="#9ca3af" style={tw`mb-4`} />
            <Text style={tw`text-lg font-medium text-gray-700 mb-2`}>No hay croquis guardados</Text>
            <Text style={tw`text-gray-500 text-center mb-6`}>Crea tu primer croquis para empezar a asignar trabajos.</Text>
            <TouchableOpacity
              onPress={handleCreateNew}
              style={tw`bg-[#dcf0fa] px-6 py-3 rounded-lg border border-sky-200`}
            >
              <Text style={tw`text-blue-900 font-bold`}>Crear Croquis</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView>
            <View style={tw`flex-row flex-wrap gap-4`}>
              {croquisList.map((croquis) => (
                <View key={croquis.id} style={tw`bg-white p-5 rounded-xl shadow-sm border border-gray-100 w-full sm:w-[48%] lg:w-[31%]`}>
                  <View style={tw`flex-row items-center mb-3`}>
                    <MapIcon size={24} color="#0284c7" style={tw`mr-3`} />
                    <Text style={tw`text-lg font-bold text-gray-800 flex-1`} numberOfLines={1}>
                      {croquis.nombre}
                    </Text>
                  </View>
                  
                  <View style={tw`flex-row justify-between items-center mt-4 pt-4 border-t border-gray-100`}>
                    <Text style={tw`text-xs text-gray-500`}>
                      {croquis.elements?.length || 0} elementos
                    </Text>
                    <View style={tw`flex-row gap-2`}>
                      <TouchableOpacity
                        onPress={() => handleRename(croquis)}
                        style={tw`bg-gray-50 p-2 rounded-lg border border-gray-200`}
                      >
                        <Edit2 size={16} color="#4b5563" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleEdit(croquis)}
                        style={tw`bg-[#dcf0fa] p-2 rounded-lg border border-sky-200`}
                      >
                        <MapIcon size={16} color="#0284c7" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(croquis.id)}
                        style={tw`bg-red-50 p-2 rounded-lg border border-red-100`}
                      >
                        <Trash2 size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Rename Modal */}
        {croquisToRename && (
          <View style={tw`absolute inset-0 bg-black/50 flex items-center justify-center z-50`}>
            <View style={tw`bg-white p-6 rounded-xl shadow-xl w-80 max-w-[90%]`}>
              <Text style={tw`text-xl font-bold text-gray-800 mb-4`}>Renombrar Croquis</Text>
              <TextInput
                value={croquisToRename.name}
                onChangeText={(t) => setCroquisToRename({ ...croquisToRename, name: t })}
                placeholder="Nombre del Croquis"
                style={tw`border border-gray-300 rounded-lg p-3 bg-gray-50 mb-6 text-gray-800`}
                autoFocus
              />
              <View style={tw`flex-row justify-end gap-3`}>
                <TouchableOpacity 
                  onPress={cancelRename}
                  style={tw`px-4 py-2 rounded-lg bg-gray-100`}
                >
                  <Text style={tw`text-gray-700 font-medium`}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={confirmRename}
                  style={tw`px-4 py-2 rounded-lg bg-[#dcf0fa]`}
                >
                  <Text style={tw`text-blue-900 font-medium`}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Delete Confirmation Modal */}
        {croquisToDelete && (
          <View style={tw`absolute inset-0 bg-black/50 flex items-center justify-center z-50`}>
            <View style={tw`bg-white p-6 rounded-xl shadow-xl w-80 max-w-[90%]`}>
              <Text style={tw`text-xl font-bold text-gray-800 mb-2`}>Eliminar Croquis</Text>
              <Text style={tw`text-gray-600 mb-6`}>¿Estás seguro de que deseas eliminar este croquis? Esta acción no se puede deshacer.</Text>
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

  return (
    <View style={tw`flex-1 flex-col h-full bg-gray-100`}>
      {/* Editor Header */}
      <View style={tw`bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between shadow-sm z-20`}>
        <View style={tw`flex-row items-center`}>
          <TouchableOpacity 
            onPress={() => {
              setConfirmDialog({
                visible: true,
                title: 'Salir sin guardar',
                message: '¿Salir sin guardar? Se perderán los cambios no guardados.',
                onConfirm: () => {
                  setHasUnsavedChanges(false);
                  setViewMode('list');
                }
              });
            }}
            style={tw`mr-4 p-2 bg-gray-100 rounded-full`}
          >
            <ChevronLeft size={20} color="#4b5563" />
          </TouchableOpacity>
          <TextInput
            value={currentCroquisName}
            onChangeText={setCurrentCroquisName}
            placeholder="Nombre del Croquis"
            style={tw`text-lg font-bold text-gray-800 border-b border-transparent hover:border-gray-300 focus:border-sky-500 pb-1 min-w-[200px]`}
          />
        </View>
        <TouchableOpacity
          onPress={saveCroquis}
          disabled={loading}
          style={tw`bg-[#dcf0fa] px-4 py-2 rounded-lg flex-row items-center shadow-sm ${loading ? 'opacity-50' : ''}`}
        >
          <Save size={18} color="#1e3a8a" style={tw`mr-2`} />
          <Text style={tw`text-blue-900 font-bold`}>{loading ? 'Guardando...' : 'Guardar Croquis'}</Text>
        </TouchableOpacity>
      </View>

      <View style={tw`flex-1 flex-row`}>
        {/* Toolbar */}
        <View style={tw`w-20 bg-white border-r border-gray-200 items-center py-4 gap-2 shadow-sm z-10`}>
          {Tools.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => changeTool(t.id as ToolType)}
              style={tw`p-2 rounded-lg items-center justify-center w-16 ${tool === t.id ? 'bg-[#dcf0fa]' : 'hover:bg-gray-100'}`}
            >
              <t.icon size={20} color={tool === t.id ? '#0284c7' : '#4b5563'} />
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
        <View 
        style={tw`flex-1 relative overflow-hidden bg-gray-50`}
        onLayout={onLayout}
      >
        <Stage
          width={stageDimensions.width}
          height={stageDimensions.height}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          draggable={tool === 'pan'}
          onDragEnd={(e) => setStagePos(e.target.position())}
          onMouseDown={handleStageClick}
          onMouseMove={(e) => {
            const stage = e.target.getStage();
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const scale = stage.scaleX();
            setCursorPos({
              x: (pointer.x - stage.x()) / scale,
              y: (pointer.y - stage.y()) / scale
            });
          }}
          onMouseLeave={() => setCursorPos(null)}
          onWheel={(e) => {
            if (isSpacePressedRef.current) {
              e.evt.preventDefault();
              const scaleBy = 1.1;
              const stage = e.target.getStage();
              if (!stage) return;
              const oldScale = stage.scaleX();
              const pointer = stage.getPointerPosition();
              if (!pointer) return;

              const mousePointTo = {
                x: (pointer.x - stage.x()) / oldScale,
                y: (pointer.y - stage.y()) / oldScale,
              };

              const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
              setStageScale(newScale);
              setStagePos({
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
              });
            }
          }}
          ref={stageRef}
          style={{ cursor: tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
        >
          <Layer>
            {/* Grid Background */}
            <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#f9fafb" />
            
            {/* Render Elements */}
            {elements
              .slice()
              .sort((a, b) => {
                const order: Record<string, number> = { barrio: 0, manzana: 1, street: 2, vivienda: 3, reference: 4 };
                return (order[a.type] || 0) - (order[b.type] || 0);
              })
              .map((el) => {
              const isSelected = selectedId === el.id;
              if (el.type === 'street') {
                return (
                  <Group
                    key={el.id}
                    onClick={() => tool === 'select' && setSelectedId(el.id)}
                    onTap={() => tool === 'select' && setSelectedId(el.id)}
                  >
                    {isSelected && (
                      <Line
                        points={el.points}
                        stroke="#0284c7"
                        strokeWidth={(el.style?.strokeWidth || 20) + 6}
                        lineCap="round"
                        lineJoin="round"
                        opacity={0.5}
                      />
                    )}
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
                const centroid = el.points ? getCentroid(el.points) : { x: 0, y: 0 };
                return (
                  <Group
                    key={el.id}
                    onClick={() => tool === 'select' && setSelectedId(el.id)}
                    onTap={() => tool === 'select' && setSelectedId(el.id)}
                  >
                    <Line
                      points={el.points}
                      closed={true}
                      stroke={isSelected ? '#0284c7' : el.style?.stroke}
                      fill={el.style?.fill}
                      strokeWidth={el.style?.strokeWidth}
                    />
                    {el.type === 'manzana' && isManzanaInAnyBarrio(el) && el.data.blockNumber && (
                       <KonvaText
                        x={centroid.x}
                        y={centroid.y}
                        offsetX={30}
                        offsetY={30}
                        text={el.data.blockNumber}
                        fontSize={48}
                        fontStyle="bold"
                        fill="#000"
                        align="center"
                       />
                    )}
                    {el.type === 'barrio' && el.data.label && (
                       <KonvaText
                        x={centroid.x}
                        y={centroid.y}
                        text={el.data.label}
                        fontSize={40}
                        fill="#0284c7"
                        fontStyle="italic"
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
                      width={32}
                      height={32}
                      offsetX={16}
                      offsetY={16}
                      fill={isSelected ? '#0284c7' : el.style?.fill}
                      stroke={el.style?.stroke}
                      strokeWidth={2}
                    />
                    <KonvaText
                      y={-45}
                      x={-15}
                      text={el.data.label}
                      fontSize={28}
                      fill="#000"
                      fontStyle="bold"
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
                    <Circle
                      radius={24}
                      fill={isSelected ? '#0284c7' : el.style?.fill}
                      stroke={el.style?.stroke}
                      strokeWidth={2}
                    />
                    <Circle
                      radius={8}
                      fill="#fff"
                    />
                    <KonvaText
                      y={-55}
                      x={-50}
                      width={100}
                      align="center"
                      text={el.data.label}
                      fontSize={32}
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
                stroke="#0284c7"
                strokeWidth={2}
                dash={[10, 5]}
                closed={tool === 'manzana' || tool === 'barrio'}
              />
            )}

            {/* Dynamic Measuring Line */}
            {currentPoints.length >= 2 && cursorPos && ['street', 'manzana', 'barrio'].includes(tool) && (
              <Group>
                <Line
                  points={[
                    currentPoints[currentPoints.length - 2],
                    currentPoints[currentPoints.length - 1],
                    cursorPos.x,
                    cursorPos.y
                  ]}
                  stroke="#ef4444"
                  strokeWidth={2 / stageScale}
                  dash={[5 / stageScale, 5 / stageScale]}
                />
                {(() => {
                  const lastX = currentPoints[currentPoints.length - 2];
                  const lastY = currentPoints[currentPoints.length - 1];
                  const midX = (lastX + cursorPos.x) / 2;
                  const midY = (lastY + cursorPos.y) / 2;
                  const distance = Math.sqrt(Math.pow(cursorPos.x - lastX, 2) + Math.pow(cursorPos.y - lastY, 2));
                  const distanceMeters = (distance / 10).toFixed(1); // Assuming 10px = 1m for display purposes
                  
                  return (
                    <Group x={midX} y={midY}>
                      <Rect
                        x={-25 / stageScale}
                        y={-10 / stageScale}
                        width={50 / stageScale}
                        height={20 / stageScale}
                        fill="#ef4444"
                        cornerRadius={10 / stageScale}
                      />
                      <KonvaText
                        x={-25 / stageScale}
                        y={-6 / stageScale}
                        width={50 / stageScale}
                        text={`${distanceMeters}m`}
                        fontSize={10 / stageScale}
                        fill="#ffffff"
                        align="center"
                        fontStyle="bold"
                      />
                    </Group>
                  );
                })()}
              </Group>
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
              style={tw`bg-[#dcf0fa] px-6 py-3 rounded-full shadow-lg z-20`}
            >
              <Text style={tw`text-blue-900 font-bold`}>Terminar Dibujo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Properties Panel */}
      <View style={tw`w-72 bg-white border-l border-gray-200 shadow-sm z-10 flex-col`}>
        <ScrollView contentContainerStyle={tw`p-4 flex-grow`}>
          <Text style={tw`text-lg font-bold text-gray-800 mb-4`}>Propiedades</Text>
          
          {selectedId ? (
            <View style={tw`gap-4`}>
            <View>
              <Text style={tw`text-xs text-gray-500 font-bold uppercase mb-1`}>
                {elements.find(e => e.id === selectedId)?.type === 'reference' ? 'Punto de Referencia' : 'Etiqueta / Nombre'}
              </Text>
              <TextInput
                value={propLabel}
                onChangeText={(t) => {
                  setPropLabel(t);
                  updateSelectedProperty('label', t);
                }}
                style={tw`border border-gray-300 rounded p-2 bg-gray-50`}
              />
            </View>

            {elements.find(e => e.id === selectedId)?.type === 'manzana' && isManzanaInAnyBarrio(elements.find(e => e.id === selectedId)!) && (
              <View>
                <Text style={tw`text-xs text-gray-500 font-bold uppercase mb-1`}>Número de Manzana</Text>
                <TextInput
                  value={propBlockNumber}
                  onChangeText={(t) => {
                    setPropBlockNumber(t);
                    updateSelectedProperty('blockNumber', t);
                  }}
                  keyboardType="numeric"
                  style={tw`border border-gray-300 rounded p-2 bg-gray-50 font-bold text-lg`}
                />
              </View>
            )}

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
                          ? 'bg-[#dcf0fa] border-sky-500' 
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
                        elements.filter(el => 
                            el.type === 'vivienda' && 
                            elements.find(m => m.id === selectedId)?.points &&
                            isPointInPolygon(el.x!, el.y!, elements.find(m => m.id === selectedId)!.points!)
                        ).length.toString()
                    }
                    editable={false}
                    style={tw`border border-gray-200 rounded p-2 bg-gray-100 text-gray-500`}
                  />
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

          <View style={tw`mt-auto pt-4`}>
            <TouchableOpacity 
              onPress={saveCroquis}
              disabled={loading}
              style={tw`bg-green-600 py-3 rounded-lg flex-row items-center justify-center shadow-sm ${loading ? 'opacity-50' : ''}`}
            >
              <Save size={18} color="white" style={tw`mr-2`} />
              <Text style={tw`text-white font-bold`}>{loading ? "Guardando..." : "Guardar Croquis"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
      </View>
      {/* Confirm Dialog */}
      {confirmDialog.visible && (
        <View style={[tw`absolute inset-0 bg-black/50 z-50 items-center justify-center`, { position: 'absolute' as any }]}>
          <View style={tw`bg-white p-6 rounded-xl w-80 shadow-xl`}>
            <Text style={tw`text-lg font-bold text-gray-800 mb-2`}>{confirmDialog.title}</Text>
            <Text style={tw`text-sm text-gray-600 mb-6`}>{confirmDialog.message}</Text>
            <View style={tw`flex-row justify-end gap-3`}>
              <TouchableOpacity
                onPress={() => setConfirmDialog({ ...confirmDialog, visible: false })}
                style={tw`px-4 py-2 rounded-lg bg-gray-100`}
              >
                <Text style={tw`text-gray-700 font-medium`}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, visible: false });
                }}
                style={tw`px-4 py-2 rounded-lg bg-red-600`}
              >
                <Text style={tw`text-white font-medium`}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
