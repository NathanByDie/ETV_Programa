import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Stage, Layer, Line, Rect, Text as KonvaText, Group, Circle } from "react-konva";
import Konva from "konva";
import { format, subDays, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle, Map as MapIcon, Target } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";
import html2pdf from "html2pdf.js";

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

export default function OperativoFoco() {
  const [tipo, setTipo] = useState<"fumigacion" | "abatizacion">("fumigacion");
  const [lugarType, setLugarType] = useState<"barrio" | "comarca">("barrio");
  const [lugarNombre, setLugarNombre] = useState("");
  const [manzanas, setManzanas] = useState(""); 
  
  const [allCroquis, setAllCroquis] = useState<CroquisData[]>([]);
  const [selectedCroquisId, setSelectedCroquisId] = useState("");
  const [selectedBarrioId, setSelectedBarrioId] = useState("");
  const [availableBarrios, setAvailableBarrios] = useState<CroquisElement[]>([]);
  const [availableManzanas, setAvailableManzanas] = useState<CroquisElement[]>([]);
  const [selectedManzanas, setSelectedManzanas] = useState<string[]>([]);

  const [modoFoco, setModoFoco] = useState(true); // Default to true for this page
  const [focoPoint, setFocoPoint] = useState<{x: number, y: number} | null>(null);
  const [focoRadius, setFocoRadius] = useState(500); // 500 meters

  const [loading, setLoading] = useState(false);
  const [validationMsg, setValidationMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const [previewScale, setPreviewScale] = useState(0.5);
  const [previewPos, setPreviewPos] = useState({ x: 0, y: 0 });
  const previewStageRef = useRef<any>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const handlePrint = () => {
    if (!previewHtml) return;
    
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.innerHTML = previewHtml;
    
    const style = document.createElement('style');
    style.id = 'print-style';
    style.innerHTML = `
      @media print {
        #root {
          display: none !important;
        }
        body {
          background-color: white !important;
          margin: 0;
          padding: 0;
        }
        @page { margin: 0; size: legal portrait; }
        #print-container {
          display: block !important;
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        #pdf-content { 
          width: 215.9mm !important; 
          height: 355.6mm !important;
          padding: 10mm !important; 
          margin: 0 auto !important;
          box-sizing: border-box !important;
          box-shadow: none !important;
          display: flex !important;
          flex-direction: column !important;
          page-break-after: always;
        }
        #pdf-content:last-child {
          page-break-after: avoid;
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(printContainer);
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.head.removeChild(style);
        document.body.removeChild(printContainer);
      }, 1000);
    }, 500);
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
        const cData = await api.getAllCroquis();
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

        // Auto-fit preview map to entire croquis bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        croquis.elements.forEach(el => {
          if (el.points) {
            for (let i = 0; i < el.points.length; i += 2) {
              minX = Math.min(minX, el.points[i]);
              maxX = Math.max(maxX, el.points[i]);
              minY = Math.min(minY, el.points[i+1]);
              maxY = Math.max(maxY, el.points[i+1]);
            }
          }
          if (el.x !== undefined && el.y !== undefined) {
            minX = Math.min(minX, el.x);
            maxX = Math.max(maxX, el.x);
            minY = Math.min(minY, el.y);
            maxY = Math.max(maxY, el.y);
          }
        });

        if (minX !== Infinity) {
          const padding = 40;
          const width = maxX - minX;
          const height = maxY - minY;
          
          const stageWidth = window.innerWidth > 800 ? 800 : window.innerWidth - 60;
          const stageHeight = 500;
          
          const scaleX = stageWidth / (width + padding * 2 || 1);
          const scaleY = stageHeight / (height + padding * 2 || 1);
          const scale = Math.min(scaleX, scaleY, 1);
          
          setPreviewScale(scale);
          setPreviewPos({
            x: -(minX * scale) + (stageWidth - width * scale) / 2 - (stageWidth / 2),
            y: -(minY * scale) + (stageHeight - height * scale) / 2 - (stageHeight / 2)
          });
        }
      }
    } else {
      setAvailableBarrios([]);
      setSelectedBarrioId("");
    }
  }, [selectedCroquisId, allCroquis]);

  // Update manzanas when barrio changes
  useEffect(() => {
    setFocoPoint(null);
    // setModoFoco(false); // Keep modoFoco true

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
        // By default, do NOT select any manzanas
        setSelectedManzanas([]);

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
        
        const stageWidth = window.innerWidth > 800 ? 800 : window.innerWidth - 60;
        const stageHeight = 500;
        
        const scaleX = stageWidth / (width + padding * 2 || 1);
        const scaleY = stageHeight / (height + padding * 2 || 1);
        const scale = Math.min(scaleX, scaleY, 1);
        
        setPreviewScale(scale);
        setPreviewPos({
          x: -(minX * scale) + (stageWidth - width * scale) / 2 - (stageWidth / 2),
          y: -(minY * scale) + (stageHeight - height * scale) / 2 - (stageHeight / 2)
        });
      }
    } else if (!selectedBarrioId && selectedCroquisId) {
      setAvailableManzanas([]);
      setSelectedManzanas([]);
      
      // Refit to whole croquis if barrio is deselected
      const croquis = allCroquis.find(c => c.id === selectedCroquisId);
      if (croquis) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        croquis.elements.forEach(el => {
          if (el.points) {
            for (let i = 0; i < el.points.length; i += 2) {
              minX = Math.min(minX, el.points[i]);
              maxX = Math.max(maxX, el.points[i]);
              minY = Math.min(minY, el.points[i+1]);
              maxY = Math.max(maxY, el.points[i+1]);
            }
          }
          if (el.x !== undefined && el.y !== undefined) {
            minX = Math.min(minX, el.x);
            maxX = Math.max(maxX, el.x);
            minY = Math.min(minY, el.y);
            maxY = Math.max(maxY, el.y);
          }
        });

        if (minX !== Infinity) {
          const padding = 40;
          const width = maxX - minX;
          const height = maxY - minY;
          
          const stageWidth = window.innerWidth > 800 ? 800 : window.innerWidth - 60;
          const stageHeight = 500;
          
          const scaleX = stageWidth / (width + padding * 2 || 1);
          const scaleY = stageHeight / (height + padding * 2 || 1);
          const scale = Math.min(scaleX, scaleY, 1);
          
          setPreviewScale(scale);
          setPreviewPos({
            x: -(minX * scale) + (stageWidth - width * scale) / 2 - (stageWidth / 2),
            y: -(minY * scale) + (stageHeight - height * scale) / 2 - (stageHeight / 2)
          });
        }
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

  useEffect(() => {
    if (modoFoco && focoPoint && selectedCroquisId) {
      const mapScale = 10;
      const effectiveRadius = focoRadius * mapScale;
      const croquis = allCroquis.find(c => c.id === selectedCroquisId);
      if (croquis) {
        const allManzanas = croquis.elements.filter(el => el.type === 'manzana' && el.points);
        const nearbyManzanas = allManzanas.filter(m => {
          const center = getCentroid(m.points!);
          const dist = Math.sqrt(Math.pow(center.x - focoPoint.x, 2) + Math.pow(center.y - focoPoint.y, 2));
          return dist <= effectiveRadius;
        });
        setSelectedManzanas(nearbyManzanas.map(m => m.id));
      }
    }
  }, [focoRadius, focoPoint, modoFoco, selectedCroquisId, allCroquis]);

  const toggleManzana = (id: string) => {
    setSelectedManzanas(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleMapClick = (e: any) => {
    if (!modoFoco) return;
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    
    // Transform pointer to stage coordinates
    const scale = stage.scaleX();
    const x = (pointer.x - stage.x()) / scale;
    const y = (pointer.y - stage.y()) / scale;
    
    setFocoPoint({ x, y });
  };

  const generatePreview = async () => {
    if (!selectedManzanas.length) {
      setValidationMsg({ type: 'error', text: 'Seleccione al menos una manzana' });
      return;
    }

    setLoading(true);

    try {
      // Group selected manzanas by barrio
      const croquis = allCroquis.find(c => c.id === selectedCroquisId);
      if (!croquis) {
        setLoading(false);
        return;
      }

      const barriosMap = new Map<string, CroquisElement[]>();
      const unknownBarrioId = "unknown";

      selectedManzanas.forEach(mId => {
        const manzana = croquis.elements.find(el => el.id === mId);
        if (manzana && manzana.points) {
          // Find which barrio this manzana belongs to
          const barrio = croquis.elements.find(el => 
            el.type === 'barrio' && el.points && isPointInPolygon(manzana.points![0], manzana.points![1], el.points)
          );
          
          const bId = barrio ? barrio.id : unknownBarrioId;
          if (!barriosMap.has(bId)) {
            barriosMap.set(bId, []);
          }
          barriosMap.get(bId)!.push(manzana);
        }
      });

      let fullHtmlContent = "";
      const date = format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });

      // Save to history (asignaciones collection)
      const allAsignaciones = await api.getAsignaciones();
      const today = new Date().toISOString().split('T')[0];
      const todayAsignaciones = allAsignaciones.filter((a: any) => {
        if (!a.fecha) return false;
        const dateStr = typeof a.fecha === 'string' ? a.fecha : new Date(a.fecha.seconds * 1000).toISOString();
        return dateStr.split('T')[0] === today;
      });
      const trabajoNumero = todayAsignaciones.length + 1;

      // Create an assignment record for the Foco operation
      await api.addAsignacion({
        tipo: "fumigacion", // Foco is usually fumigation
        lugarType: "barrio",
        lugarNombre: "Operativo Foco",
        manzanas: selectedManzanas,
        brigadistaId: "N/A",
        brigadistaNombre: "N/A",
        fecha: new Date().toISOString(),
        status: "completado", // Mark as completed since it's an immediate operation
        croquisId: selectedCroquisId,
        barrioId: selectedBarrioId || "unknown",
        trabajoNumero
      });

      // Iterate over each barrio group and generate a document page
      for (const [bId, manzanasList] of barriosMap.entries()) {
        const barrio = croquis.elements.find(el => el.id === bId);
      const barrioName = barrio ? (barrio.data.label || "Barrio Desconocido") : "Barrio Desconocido";

      let totalViviendas = 0;
      let totalHabitantes = 0;
      let tableRows = "";

      manzanasList.forEach((m, index) => {
        const label = m.data.label || `M-${index + 1}`;
        const ref = getReferenceForManzana(m, croquis.elements);
        
        // Use houseCount from the manzana data
        const viviendas = parseInt(m.data.houseCount || '0', 10);
        
        // Use inhabitants from the manzana data
        const habitantes = parseInt(m.data.inhabitants || '0', 10);
        
        totalViviendas += isNaN(viviendas) ? 0 : viviendas;
        totalHabitantes += isNaN(habitantes) ? 0 : habitantes;

        tableRows += `
          <tr>
            ${index === 0 ? `<td rowspan="${manzanasList.length}" style="border: 1px solid #000; padding: 6px 8px; font-size: 12px; font-weight: bold; vertical-align: middle;">Trabajo No ${trabajoNumero}</td>` : ''}
            <td style="border: 1px solid #000; padding: 6px 8px; font-size: 12px; text-align: center; font-weight: bold;">${label}</td>
            <td style="border: 1px solid #000; padding: 6px 8px; font-size: 12px; text-align: center;">${isNaN(viviendas) ? '' : viviendas}</td>
            <td style="border: 1px solid #000; padding: 6px 8px; font-size: 12px; text-align: center;">${isNaN(habitantes) ? '' : habitantes}</td>
            <td style="border: 1px solid #000; padding: 6px 8px; font-size: 12px;"></td>
            <td style="border: 1px solid #000; padding: 6px 8px; font-size: 12px;">${ref}</td>
          </tr>
        `;
      });

      // Generate map image for this barrio's selected manzanas
      // We need to calculate bounds for this specific group of manzanas
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      manzanasList.forEach(m => {
        if (m.points) {
          for (let i = 0; i < m.points.length; i += 2) {
            minX = Math.min(minX, m.points[i]);
            maxX = Math.max(maxX, m.points[i]);
            minY = Math.min(minY, m.points[i+1]);
            maxY = Math.max(maxY, m.points[i+1]);
          }
        }
      });

      // Add some padding
      const padding = 20;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;
      const width = maxX - minX;
      const height = maxY - minY;

      // Create a temporary stage to export image
      const container = document.createElement('div');
      document.body.appendChild(container);
      
      const stage = new Konva.Stage({
        container: container,
        width: width,
        height: height,
      });

      const layer = new Konva.Layer();
      stage.add(layer);

      // Draw manzanas
      manzanasList.forEach(m => {
        if (m.points) {
          const poly = new Konva.Line({
            points: m.points.map((p, i) => i % 2 === 0 ? p - minX : p - minY),
            fill: '#e0f2fe',
            stroke: '#0284c7',
            strokeWidth: 2,
            closed: true,
          });
          layer.add(poly);

          const center = getCentroid(m.points);
          const text = new Konva.Text({
            x: center.x - minX - 10,
            y: center.y - minY - 5,
            text: m.data.label || 'M',
            fontSize: 12,
            fill: 'black',
          });
          layer.add(text);
        }
      });

      // Draw irregular area hull (optional, or just the manzanas themselves is enough as per request "irregular area covered depending on the forms of the manzanas")
      // The user said "area marked... irregular... depending on the forms of the manzanas". 
      // Showing the selected manzanas highlighted (as done above) effectively shows the irregular area.

      layer.draw();
      const mapImage = stage.toDataURL();
      document.body.removeChild(container);

      const htmlContent = `
        <div id="pdf-content" style="width: 215.9mm !important; height: 355.6mm !important; padding: 10mm !important; margin: 0 auto !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important; page-break-after: always;">
          <div class="header" style="text-align: center; margin-bottom: 20px; position: relative;">
            <!-- Logo Izquierdo -->
            <img src="https://www.minsa.gob.ni/sites/default/files/Logo-01.png" style="position: absolute; left: 0; top: 0; width: 170px; height: 80px; object-fit: contain;" />
            <!-- Logo Derecho -->
            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDUPykT7GOjsNSvJL_ePAoTw3WEihUfGo80A&s" style="position: absolute; right: 0; top: 0; width: 190px; height: 70px; object-fit: contain;" />
            
            <h3 style="margin: 4px 0; font-size: 20px; color: #000;">MINISTERIO DE SALUD</h3>
            <h3 style="margin: 4px 0; font-size: 20px; color: #000;">HOSPITAL PRIMARIO DE CAMOAPA</h3>
            <h4 style="margin: 4px 0; font-size: 18px; color: #000;">PROGRAMA DE E.T.V</h4>
            <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 15px; color: #000;">
              <span>Consolidado Diario - Operativo Foco</span>
              <span>Fecha: ${date}</span>
            </div>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1pt solid black;">
            <tr>
              <td colspan="6" style="background-color: #93c5fd !important; color: black; font-weight: bold; text-align: center; font-size: 18px; padding: 6px; border: 1pt solid black;">PROGRAMA E.T.V CAMOAPA-BOACO</td>
            </tr>
            <tr>
              <td colspan="6" style="background-color: #93c5fd !important; color: black; font-weight: bold; text-align: center; font-size: 18px; padding: 6px; border: 1pt solid black;">RELACION POR MANZANA</td>
            </tr>
            <tr>
              <td colspan="6" style="background-color: #93c5fd !important; color: black; font-weight: bold; text-align: center; font-size: 18px; padding: 6px; border: 1pt solid black;">BARRIO: ${barrioName.toUpperCase()}</td>
            </tr>
            <tr>
              <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;"></th>
              <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">Manz<br>No</th>
              <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">vivienda<br>Existentes</th>
              <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">No<br>Habitantes</th>
              <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">Casas<br>Nuevas</th>
              <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">Punto de Referencia</th>
            </tr>
            ${tableRows.replace(/border: 1px solid #000;/g, 'border: 1pt solid black;').replace(/font-size: 12px;/g, 'font-size: 16px; color: black;').replace(/padding: 6px 8px;/g, 'padding: 4px 6px;')}
            <tr style="background-color: #fbbf24 !important; font-weight: bold; color: black;">
              <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px;">TOTAL</td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; text-align: center;">${manzanasList.length}</td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; text-align: center;">${totalViviendas || ''}</td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; text-align: center;">${totalHabitantes || ''}</td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px;"></td>
            </tr>
          </table>

          ${mapImage ? `
          <div style="border: 1pt solid black; padding: 2px; margin-bottom: 15px; text-align: center; min-height: 160px; flex-grow: 1; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <img src="${mapImage}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
          ` : '<div style="border: 1pt solid black; padding: 2px; margin-bottom: 15px; text-align: center; min-height: 160px; flex-grow: 1; display: flex; align-items: center; justify-content: center;"><p>Sin mapa</p></div>'}

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 14px; border: 1pt solid black;">
            <tr>
              <th colspan="2" style="border: 1pt solid black; padding: 4px 6px; background-color: #f1f5f9 !important; text-align: center; color: black;">ACTIVIDAD DE FUMIGACION</th>
              <th colspan="2" style="border: 1pt solid black; padding: 4px 6px; background-color: #f1f5f9 !important; text-align: center; color: black;">ACTIVIDAD DE APLICACION</th>
              <th colspan="2" style="border: 1pt solid black; padding: 4px 6px; background-color: #f1f5f9 !important; text-align: center; color: black;">DEPOSITOS</th>
            </tr>
            <tr>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Fumigadas</td><td style="border: 1pt solid black; width: 40px;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Inspeccionadas</td><td style="border: 1pt solid black; width: 40px;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Depósitos Eliminados</td><td style="border: 1pt solid black; width: 40px;"></td>
            </tr>
            <tr>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Cerradas</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Tratadas</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Depósitos Cepillados</td><td style="border: 1pt solid black;"></td>
            </tr>
            <tr>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Renuentes</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Positivas</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Depósitos Tratados</td><td style="border: 1pt solid black;"></td>
            </tr>
            <tr>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Deshabitada</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Cerradas</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Depósitos Inspeccionados</td><td style="border: 1pt solid black;"></td>
            </tr>
            <tr>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Manzanas Fumigadas</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Desabitadas</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Depósitos Positivos</td><td style="border: 1pt solid black;"></td>
            </tr>
            <tr>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Habitantes Protegidos</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Viviendas Renuentes</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Abate en Kg Utilizado</td><td style="border: 1pt solid black;"></td>
            </tr>
            <tr>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Puntos Claves Fumigados</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Total de Viviendas Visitadas</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px;"></td><td style="border: 1pt solid black;"></td>
            </tr>
            <tr>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Cipermetrina Gastada</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px; font-weight: bold;">Puntos clave Tratados</td><td style="border: 1pt solid black;"></td>
              <td style="border: 1pt solid black; padding: 4px 6px;"></td><td style="border: 1pt solid black;"></td>
            </tr>
          </table>

          <div style="margin-bottom: 8px; display: flex; align-items: flex-end;">
            <span style="font-weight: bold; margin-right: 8px; white-space: nowrap; font-size: 16px; color: black;">Nombres y Apellidos del Caso Sospechoso</span>
            <div style="flex: 1; border-bottom: 1pt solid black; height: 16px;"></div>
          </div>
          <div style="margin-bottom: 8px; display: flex; align-items: flex-end;">
            <span style="font-weight: bold; margin-right: 8px; white-space: nowrap; font-size: 16px; color: black;">Jefe de Familia del Caso Sospechoso</span>
            <div style="flex: 1; border-bottom: 1pt solid black; height: 16px;"></div>
          </div>
          <div style="margin-bottom: 8px; display: flex; align-items: flex-end;">
            <span style="font-weight: bold; margin-right: 8px; white-space: nowrap; font-size: 16px; color: black;">Fecha de Nacimiento</span>
            <div style="flex: 0.5; border-bottom: 1pt solid black; height: 16px;"></div>
            <span style="font-weight: bold; margin-right: 8px; margin-left: 10px; white-space: nowrap; font-size: 16px; color: black;">Edad</span>
            <div style="flex: 0.2; border-bottom: 1pt solid black; height: 16px;"></div>
            <span style="font-weight: bold; margin-right: 8px; margin-left: 10px; white-space: nowrap; font-size: 16px; color: black;">Sexo</span>
            <div style="flex: 0.2; border-bottom: 1pt solid black; height: 16px;"></div>
            <span style="font-weight: bold; margin-right: 8px; margin-left: 10px; white-space: nowrap; font-size: 16px; color: black;">Barrio O Comunidad</span>
            <div style="flex: 1; border-bottom: 1pt solid black; height: 16px;"></div>
          </div>
          <div style="margin-bottom: 8px; display: flex; align-items: flex-end;">
            <span style="font-weight: bold; margin-right: 8px; white-space: nowrap; font-size: 16px; color: black;">Dirección</span>
            <div style="flex: 1; border-bottom: 1pt solid black; height: 16px;"></div>
          </div>
          <div style="margin-bottom: 8px; display: flex; align-items: flex-end;">
            <span style="font-weight: bold; margin-right: 8px; white-space: nowrap; font-size: 16px; color: black;">Observacion</span>
            <div style="flex: 1; border-bottom: 1pt solid black; height: 16px;"></div>
          </div>
          <div style="margin-bottom: 8px; display: flex; align-items: flex-end;">
            <div style="flex: 1; border-bottom: 1pt solid black; height: 16px;"></div>
          </div>

          <div style="margin-top: 20px; padding-top: 10px; page-break-inside: avoid;">
            <div style="display: flex; align-items: flex-end;">
              <span style="font-weight: bold; margin-right: 8px; white-space: nowrap; font-size: 16px; color: black;">Nombre / Apellido y Firma de Recursos Participantes: </span>
              <div style="flex: 1; border-bottom: 1pt solid black; height: 16px;"></div>
            </div>
            
            <!-- Logo Inferior -->
            <div style="margin-top: 5px;">
              <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS27CGlOr9nf1ODCnqoeAYeUFqXP24AgyL9rw&s" style="width: 150px; height: 60px; object-fit: contain;" />
            </div>
          </div>
        </div>
      `;
      fullHtmlContent += htmlContent;
    }

    setPreviewHtml(fullHtmlContent);
    setValidationMsg({ type: 'success', text: 'Documentos generados y operativo guardado en el historial.' });
    } catch (e) {
      console.error("Error generating preview or saving:", e);
      setValidationMsg({ type: 'error', text: 'Error al generar documentos o guardar el operativo.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={tw`flex-1 p-4`}>
      <Text style={tw`text-3xl font-bold text-gray-800 mb-6 shrink-0`}>Operativo de Foco</Text>

      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`}>
        <View style={tw`bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6`}>
          <Text style={tw`text-lg font-semibold text-gray-700 mb-4`}>Configuración del Foco</Text>
          
          <View style={tw`mb-4`}>
            <Text style={tw`text-sm font-medium text-gray-600 mb-2`}>Seleccionar Croquis</Text>
            <View style={tw`border border-gray-300 rounded-lg overflow-hidden bg-gray-50`}>
              <CustomPicker
                selectedValue={selectedCroquisId}
                onValueChange={setSelectedCroquisId}
                items={allCroquis.map(c => ({ label: c.nombre, value: c.id }))}
                placeholder="Seleccione un croquis..."
              />
            </View>
          </View>

          {/* We don't necessarily need to select a Barrio first for Foco, but it helps to center the map. 
              Or we can just show the whole croquis. 
              Let's keep Barrio selection to help navigate. */}
          <View style={tw`mb-4`}>
            <Text style={tw`text-sm font-medium text-gray-600 mb-2`}>Centrar en Barrio (Opcional)</Text>
            <View style={tw`border border-gray-300 rounded-lg overflow-hidden bg-gray-50`}>
              <CustomPicker
                selectedValue={selectedBarrioId}
                onValueChange={setSelectedBarrioId}
                items={availableBarrios.map(b => ({ label: b.data.label || "Sin nombre", value: b.id }))}
                placeholder="Seleccione un barrio para centrar..."
              />
            </View>
          </View>
          
          <View style={tw`mb-4`}>
            <Text style={tw`text-sm font-medium text-gray-600 mb-2`}>Radio del Foco (metros)</Text>
            <TextInput
              style={tw`border border-gray-300 rounded-lg p-3 bg-gray-50`}
              value={focoRadius.toString()}
              onChangeText={(text) => setFocoRadius(Number(text) || 0)}
              keyboardType="numeric"
            />
          </View>
        </View>

        {!!selectedCroquisId && (
          <View style={tw`bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6`}>
            <Text style={tw`text-lg font-semibold text-gray-700 mb-4`}>Mapa del Foco</Text>
            <Text style={tw`text-sm text-gray-500 mb-4`}>
              Haga clic en el mapa para establecer el punto central del foco. Se seleccionarán automáticamente las manzanas dentro del radio de {focoRadius}m.
            </Text>
            
            <View style={{ overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8 }}>
              <Stage
                width={window.innerWidth > 800 ? 800 : window.innerWidth - 60}
                height={500}
                scaleX={previewScale}
                scaleY={previewScale}
                x={previewPos.x + (window.innerWidth > 800 ? 400 : (window.innerWidth - 60)/2)} 
                y={previewPos.y + 250}
                draggable
                onClick={handleMapClick}
                onTap={handleMapClick}
                ref={previewStageRef}
              >
                <Layer>
                  {/* Draw all barrios/manzanas of the croquis */}
                  {!!selectedCroquisId && allCroquis.find(c => c.id === selectedCroquisId)?.elements.map((el, i) => {
                    if (el.type === 'manzana' && el.points) {
                      const isSelected = selectedManzanas.includes(el.id);
                      return (
                        <Group key={i}>
                          <Line
                            points={el.points}
                            fill={isSelected ? "#bae6fd" : "#f3f4f6"}
                            stroke={isSelected ? "#0284c7" : "#9ca3af"}
                            strokeWidth={2}
                            closed
                          />
                          {!!el.data.label && (
                            <KonvaText
                              x={getCentroid(el.points).x - 10}
                              y={getCentroid(el.points).y - 5}
                              text={el.data.label}
                              fontSize={12}
                              fill="#374151"
                            />
                          )}
                        </Group>
                      );
                    }
                    return null;
                  })}

                  {/* Draw Foco Point and Radius */}
                  {!!focoPoint && (
                    <Group>
                      <Circle
                        x={focoPoint.x}
                        y={focoPoint.y}
                        radius={5}
                        fill="red"
                      />
                      <Circle
                        x={focoPoint.x}
                        y={focoPoint.y}
                        radius={focoRadius * 10} // Apply scale factor of 10
                        stroke="red"
                        strokeWidth={1}
                        dash={[10, 10]}
                        listening={false}
                      />
                    </Group>
                  )}
                </Layer>
              </Stage>
            </View>
            
            <View style={tw`mt-4 flex-row justify-between items-center`}>
              <Text style={tw`text-gray-600`}>
                {selectedManzanas.length} manzanas seleccionadas
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedManzanas([])}
                style={tw`bg-gray-200 px-4 py-2 rounded-lg`}
              >
                <Text style={tw`text-gray-700`}>Limpiar Selección</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={tw`mt-6`}>
          <TouchableOpacity
            onPress={generatePreview}
            style={tw`bg-blue-600 p-4 rounded-xl items-center shadow-lg mb-4`}
          >
            <Text style={tw`text-white font-bold text-lg`}>Generar Documentos</Text>
          </TouchableOpacity>
        </View>

        {!!validationMsg && (
          <View style={tw`mb-6 p-4 rounded-lg ${validationMsg.type === 'error' ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <Text style={tw`${validationMsg.type === 'error' ? 'text-red-700' : 'text-green-700'}`}>
              {validationMsg.text}
            </Text>
          </View>
        )}

        {!!previewHtml && (
          <View style={tw`bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6`}>
            <Text style={tw`text-lg font-semibold text-gray-700 mb-4`}>Vista Previa</Text>
            <View style={tw`h-96 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 mb-4`}>
              <iframe
                srcDoc={previewHtml}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Vista Previa PDF"
              />
            </View>
            <TouchableOpacity
              onPress={handlePrint}
              style={tw`bg-green-600 p-4 rounded-xl items-center shadow-lg flex-row justify-center`}
            >
              <Target size={24} color="white" style={tw`mr-2`} />
              <Text style={tw`text-white font-bold text-lg`}>Imprimir Documentos</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
