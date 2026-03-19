import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from "react-native";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2, Search, Filter, MapPin, Calendar, Printer, User, Hash } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";
import { useLoading } from "../contexts/LoadingContext";

interface Asignacion {
  id: string;
  lugarNombre: string;
  lugarType: string;
  tipo: "fumigacion" | "abatizacion";
  brigadistaNombre: string;
  manzanas: string[];
  fecha: string; // ISO string from API
  mapImage?: string;
  trabajoNumero?: number;
  croquisId?: string;
}

export default function Historial() {
  const { isLoading, setLoading } = useLoading();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [filtered, setFiltered] = useState<Asignacion[]>([]);
  const [allCroquis, setAllCroquis] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "fumigacion" | "abatizacion">("todos");
  const [isFetching, setIsFetching] = useState(true);
  const [asignacionToDelete, setAsignacionToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
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

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const [asignacionesData, croquisData] = await Promise.all([
        api.getAsignaciones(),
        api.getAllCroquis()
      ]);
      setAsignaciones(asignacionesData);
      setFiltered(asignacionesData);
      setAllCroquis(croquisData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleDelete = (id: string) => {
    setAsignacionToDelete(id);
  };

  const confirmDelete = async () => {
    if (asignacionToDelete) {
      setLoading(true, 'Eliminando asignación...');
      await api.deleteAsignacion(asignacionToDelete);
      await fetchData();
      setAsignacionToDelete(null);
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setAsignacionToDelete(null);
  };

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

  const getManzanaLabel = (manzanaId: string, croquisId?: string) => {
    if (!manzanaId.startsWith('manzana-')) return manzanaId;
    
    // If we have a specific croquisId, look there first
    if (croquisId) {
      const croquis = allCroquis.find(c => c.id === croquisId);
      if (croquis) {
        const manzana = croquis.elements.find((el: any) => el.id === manzanaId);
        if (manzana && manzana.data && (manzana.data.blockNumber || manzana.data.label)) {
          return manzana.data.blockNumber || manzana.data.label;
        }
      }
    }
    
    // Otherwise search in all croquis
    for (const croquis of allCroquis) {
      const manzana = croquis.elements?.find((el: any) => el.id === manzanaId);
      if (manzana && manzana.data && (manzana.data.blockNumber || manzana.data.label)) {
        return manzana.data.blockNumber || manzana.data.label;
      }
    }
    
    return manzanaId;
  };

  const getReferenceForManzana = (manzana: any, croquisElements: any[]) => {
    if (!manzana.points) return "";
    const refs = croquisElements.filter(el => el.type === 'reference' && el.x && el.y);
    const refInside = refs.find(r => isPointInPolygon(r.x!, r.y!, manzana.points!));
    return refInside ? (refInside.data.label || "Ref") : "";
  };

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

  const generateMapImage = (barrio: any, manzanas: any[], selectedManzanas: string[]) => {
    if (!barrio || !barrio.points) return '';
    
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < barrio.points.length; i += 2) {
      minX = Math.min(minX, barrio.points[i]);
      minY = Math.min(minY, barrio.points[i + 1]);
      maxX = Math.max(maxX, barrio.points[i]);
      maxY = Math.max(maxY, barrio.points[i + 1]);
    }

    const padding = 40;
    const width = maxX - minX;
    const height = maxY - minY;
    if (width === 0 || height === 0) return '';

    const scaleX = (canvas.width - padding * 2) / width;
    const scaleY = (canvas.height - padding * 2) / height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - width * scale) / 2 - minX * scale;
    const offsetY = (canvas.height - height * scale) / 2 - minY * scale;

    ctx.fillStyle = '#f3f4f6'; // Light gray background to match preview
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Barrio
    ctx.beginPath();
    ctx.moveTo(barrio.points[0] * scale + offsetX, barrio.points[1] * scale + offsetY);
    for (let i = 2; i < barrio.points.length; i += 2) {
      ctx.lineTo(barrio.points[i] * scale + offsetX, barrio.points[i + 1] * scale + offsetY);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(220, 240, 250, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Manzanas
    manzanas.forEach(m => {
      if (!m.points) return;
      ctx.beginPath();
      ctx.moveTo(m.points[0] * scale + offsetX, m.points[1] * scale + offsetY);
      for (let i = 2; i < m.points.length; i += 2) {
        ctx.lineTo(m.points[i] * scale + offsetX, m.points[i + 1] * scale + offsetY);
      }
      ctx.closePath();
      
      const isSelected = selectedManzanas.includes(m.data.blockNumber || "S/N") || selectedManzanas.includes(m.id);
      ctx.fillStyle = isSelected ? '#1e3a8a' : 'rgba(209, 213, 219, 0.5)';
      ctx.fill();
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Text
      const centroid = getCentroid(m.points);
      ctx.fillStyle = isSelected ? '#ffffff' : '#000000';
      
      let fontSize = 30 * scale;
      const minOnScreen = 16;
      const maxOnScreen = 40;
      if (fontSize < minOnScreen) fontSize = minOnScreen;
      if (fontSize > maxOnScreen) fontSize = maxOnScreen;
      
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.data.blockNumber || 'S/N', centroid.x * scale + offsetX, centroid.y * scale + offsetY);
    });

    return canvas.toDataURL('image/png');
  };

  const handlePrint = (item: Asignacion) => {
    const date = item.fecha ? format(new Date(item.fecha), "dd 'de' MMMM, yyyy", { locale: es }) : "N/A";
    
    // Find the croquis and barrio that match this assignment
    let matchedCroquis = null;
    let matchedBarrio = null;
    let croquisElements: any[] = [];
    let availableManzanas: any[] = [];

    if (item.lugarType === 'barrio') {
      for (const croquis of allCroquis) {
        const barrio = croquis.elements.find((el: any) => el.type === 'barrio' && el.data.label === item.lugarNombre);
        if (barrio) {
          matchedCroquis = croquis;
          matchedBarrio = barrio;
          croquisElements = croquis.elements;
          
          if (barrio.points) {
            availableManzanas = croquisElements.filter(el => 
              el.type === 'manzana' && el.points && el.points.length >= 6 && (
                isPointInPolygon(el.points[0], el.points[1], barrio.points!)
              )
            );
          }
          break;
        }
      }
    }

    const selectedManzanasData = availableManzanas.filter(m => 
      item.manzanas.includes(m.data.blockNumber || "S/N") || item.manzanas.includes(m.id)
    );

    let mapImage = item.mapImage || '';
    if (!mapImage && matchedBarrio) {
      mapImage = generateMapImage(matchedBarrio, availableManzanas, item.manzanas);
    }

    let tableRows = '';
    let totalViviendas = 0;
    let totalHabitantes = 0;

    if (selectedManzanasData.length > 0) {
      selectedManzanasData.forEach((m, index) => {
        const label = m.data.blockNumber || "S/N";
        const ref = getReferenceForManzana(m, croquisElements);
        
        let calculatedHouses = 0;
        if (m.points) {
          calculatedHouses = croquisElements.filter(el => 
            el.type === 'vivienda' && el.x && el.y && isPointInPolygon(el.x, el.y, m.points!)
          ).length;
        }
        
        const viviendas = calculatedHouses;
        const habitantes = parseInt(m.data.inhabitants || '0', 10);
        
        totalViviendas += isNaN(viviendas) ? 0 : viviendas;
        totalHabitantes += isNaN(habitantes) ? 0 : habitantes;

        tableRows += `
          <tr>
            ${index === 0 ? `<td rowspan="${selectedManzanasData.length}" style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black; font-weight: bold; vertical-align: middle;">Trabajo No ${item.trabajoNumero || 1}</td>` : ''}
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black; text-align: center; font-weight: bold;">${label}</td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black; text-align: center;">${isNaN(viviendas) ? '' : viviendas}</td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black; text-align: center;">${isNaN(habitantes) ? '' : habitantes}</td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black;"></td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black;">${ref}</td>
          </tr>
        `;
      });
    } else {
      // Fallback if no manzanas found in croquis
      item.manzanas.forEach((m, index) => {
        tableRows += `
          <tr>
            ${index === 0 ? `<td rowspan="${item.manzanas.length}" style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black; font-weight: bold; vertical-align: middle;">Trabajo No ${item.trabajoNumero || 1}</td>` : ''}
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black; text-align: center; font-weight: bold;">${m}</td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black; text-align: center;"></td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black; text-align: center;"></td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black;"></td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; color: black;"></td>
          </tr>
        `;
      });
    }

    const htmlContent = `
      <div id="pdf-content" style="width: 215.9mm; min-height: 355.6mm; margin: 20px auto; padding: 15mm; box-sizing: border-box; background: white; font-family: 'Arial', sans-serif; font-size: 16px; line-height: 1.4; display: flex; flex-direction: column; position: relative; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-shadow: 0 0 10px rgba(0,0,0,0.5);">
        <div class="header" style="text-align: center; margin-bottom: 20px; position: relative;">
          <!-- Logo Izquierdo -->
          <img src="https://www.minsa.gob.ni/sites/default/files/Logo-01.png" style="position: absolute; left: 0; top: 0; width: 170px; height: 80px; object-fit: contain;" />
          <!-- Logo Derecho -->
          <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDUPykT7GOjsNSvJL_ePAoTw3WEihUfGo80A&s" style="position: absolute; right: 0; top: 0; width: 190px; height: 70px; object-fit: contain;" />
          
          <h3 style="margin: 4px 0; font-size: 20px; color: #000;">MINISTERIO DE SALUD</h3>
          <h3 style="margin: 4px 0; font-size: 20px; color: #000;">HOSPITAL PRIMARIO DE CAMOAPA</h3>
          <h4 style="margin: 4px 0; font-size: 18px; color: #000;">PROGRAMA DE E.T.V</h4>
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 15px; color: #000;">
            <span>Consolidado Diario</span>
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
            <td colspan="6" style="background-color: #93c5fd !important; color: black; font-weight: bold; text-align: center; font-size: 18px; padding: 6px; border: 1pt solid black;">BARRIO: ${item.lugarNombre.toUpperCase()}</td>
          </tr>
          <tr>
            <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;"></th>
            <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">Manz<br>No</th>
            <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">vivienda<br>Existentes</th>
            <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">No<br>Habitantes</th>
            <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">Casas<br>Nuevas</th>
            <th style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; font-weight: bold; text-align: center; color: black;">Punto de Referencia</th>
          </tr>
          ${tableRows}
          <tr style="background-color: #fbbf24 !important; font-weight: bold; color: black;">
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px;">TOTAL</td>
            <td style="border: 1pt solid black; padding: 4px 6px; font-size: 16px; text-align: center;">${item.manzanas.length}</td>
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
        ` : `
        <div style="border: 1pt solid black; padding: 2px; margin-bottom: 15px; text-align: center; min-height: 160px; flex-grow: 1; display: flex; align-items: center; justify-content: center;">
          <p>Sin mapa</p>
        </div>
        `}

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 14px; border: 1pt solid black;">
          <tr>
            <th colspan="2" style="border: 1pt solid black; padding: 4px 6px; background-color: #f1f5f9 !important; text-align: center; color: black;">ACTIVIDAD DE FUMIGACION</th>
            <th colspan="2" style="border: 1pt solid black; padding: 4px 6px; background-color: #f1f5f9 !important; text-align: center; color: black;">ACTIVIDAD DE APLICACION</th>
            <th colspan="2" style="border: 1pt solid black; padding: 4px 6px; background-color: #f1f5f9 !important; text-align: center; color: black;">DEPOSITOS</th>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Fumigadas</td><td style="border: 1pt solid black; width: 40px;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Inspeccionadas</td><td style="border: 1pt solid black; width: 40px;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Depósitos Eliminados</td><td style="border: 1pt solid black; width: 40px;"></td>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Cerradas</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Tratadas</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Depósitos Cepillados</td><td style="border: 1pt solid black;"></td>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Renuentes</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Positivas</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Depósitos Tratados</td><td style="border: 1pt solid black;"></td>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Deshabitada</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Cerradas</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Depósitos Inspeccionados</td><td style="border: 1pt solid black;"></td>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Manzanas Fumigadas</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Desabitadas</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Depósitos Positivos</td><td style="border: 1pt solid black;"></td>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Habitantes Protegidos</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Viviendas Renuentes</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Abate en Kg Utilizado</td><td style="border: 1pt solid black;"></td>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Puntos Claves Fumigados</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Total de Viviendas Visitadas</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">&nbsp;</td><td style="border: 1pt solid black;"></td>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Cipermetrina Gastada</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">Puntos clave Tratados</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">&nbsp;</td><td style="border: 1pt solid black;"></td>
          </tr>
          <tr>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">&nbsp;</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">&nbsp;</td><td style="border: 1pt solid black;"></td>
            <td style="border: 1pt solid black; padding: 3px 6px; font-weight: bold; color: black;">&nbsp;</td><td style="border: 1pt solid black;"></td>
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

    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.innerHTML = htmlContent;
    
    const style = document.createElement('style');
    style.id = 'print-style';
    style.innerHTML = `
      @media print {
        #root { display: none !important; }
        body { margin: 0; padding: 0; background-color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
        }
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(printContainer);

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (document.body.contains(printContainer)) {
          document.body.removeChild(printContainer);
        }
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      }, 1000);
    }, 250);
  };

  return (
    <View style={tw`flex-1 p-4`}>
      <View style={tw`flex-row justify-between items-center mb-6 shrink-0`}>
        <Text style={tw`text-2xl font-bold text-gray-800`}>Historial</Text>
        <Text style={tw`text-sm text-gray-500`}>{filtered.length} registros</Text>
      </View>

      {/* Filtros */}
      <View style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4 shrink-0`}>
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
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`flex-row pb-1`}>
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
              filterType === "fumigacion" ? "bg-[#dcf0fa]" : "bg-gray-100"
            }`}
          >
            <Text style={tw`text-sm font-medium ${filterType === "fumigacion" ? "text-blue-900" : "text-gray-600"}`}>
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
              Aplicación
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Lista */}
      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`}>
        <View style={tw`gap-3`}>
          {isFetching ? (
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
                    item.tipo === 'fumigacion' ? 'bg-[#dcf0fa]' : 'bg-green-100'
                  }`}>
                    <Text style={tw`text-xs font-bold uppercase ${
                      item.tipo === 'fumigacion' ? 'text-blue-900' : 'text-green-700'
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
                  {!!item.trabajoNumero && (
                    <View style={tw`flex-row items-center`}>
                      <Hash size={14} color="#9ca3af" style={tw`mr-2`} />
                      <Text style={tw`text-sm text-gray-600`}>
                        Trabajo No {item.trabajoNumero}
                      </Text>
                    </View>
                  )}
                </View>

                {!!item.manzanas?.length && (
                  <View style={tw`bg-gray-50 p-2 rounded-lg mb-3`}>
                    <Text style={tw`text-xs text-gray-500 font-medium mb-1`}>Manzanas:</Text>
                    <View style={tw`flex-row flex-wrap gap-1`}>
                      {item.manzanas.map((m, idx) => (
                        <View key={idx} style={tw`bg-white border border-gray-200 px-2 py-0.5 rounded`}>
                          <Text style={tw`text-xs text-gray-600`}>{getManzanaLabel(m, item.croquisId)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {!!item.mapImage && Platform.OS === 'web' && (
                  <View style={tw`mb-3 h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50`}>
                    <img src={item.mapImage} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </View>
                )}

                <View style={tw`flex-row justify-end items-center pt-3 border-t border-gray-50 gap-2`}>
                  <TouchableOpacity
                    onPress={() => handlePrint(item)}
                    style={tw`bg-blue-50 p-2 rounded-lg border border-blue-100 flex-row items-center`}
                  >
                    <Printer size={16} color="#0284c7" style={tw`mr-1`} />
                    <Text style={tw`text-blue-700 text-xs font-medium`}>Imprimir</Text>
                  </TouchableOpacity>
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
      </ScrollView>

      {/* Delete Confirmation Modal */}
      {!!asignacionToDelete && (
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
