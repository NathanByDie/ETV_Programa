import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import tw from 'twrnc';
import { X, DownloadCloud } from 'lucide-react';
import * as turf from '@turf/turf';

// Helper component to get map bounds
function MapBoundsTracker({ onBoundsChange }: { onBoundsChange: (bounds: any) => void }) {
  const map = useMap();
  
  useEffect(() => {
    const updateBounds = () => {
      onBoundsChange(map.getBounds());
    };
    
    map.on('moveend', updateBounds);
    map.on('zoomend', updateBounds);
    
    // Initial bounds
    updateBounds();
    
    return () => {
      map.off('moveend', updateBounds);
      map.off('zoomend', updateBounds);
    };
  }, [map, onBoundsChange]);
  
  return null;
}

interface MapImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: (elements: any[]) => void;
}

export default function MapImportModal({ visible, onClose, onImport }: MapImportModalProps) {
  const [bounds, setBounds] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const handleImport = async () => {
    if (!bounds) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const south = bounds.getSouth();
      const west = bounds.getWest();
      const north = bounds.getNorth();
      const east = bounds.getEast();
      
      // Overpass API query for residential areas, city blocks, buildings, and highways
      const query = `
        [out:json][timeout:25];
        (
          way["landuse"="residential"](${south},${west},${north},${east});
          way["place"="city_block"](${south},${west},${north},${east});
          way["building"](${south},${west},${north},${east});
          way["highway"](${south},${west},${north},${east});
        );
        out body;
        >;
        out skel qt;
      `;
      
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `data=${encodeURIComponent(query)}`
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Overpass API Error:', response.status, errorText);
        throw new Error('Error al consultar Overpass API: ' + response.status);
      }
      
      const data = await response.json();
      
      // Process OSM data into our elements format
      const nodes = new Map();
      data.elements.forEach((el: any) => {
        if (el.type === 'node') {
          nodes.set(el.id, { lat: el.lat, lon: el.lon });
        }
      });
      
      const newElements: any[] = [];
      
      // Determine a local coordinate system origin (center of bounds)
      const centerLat = (south + north) / 2;
      const centerLon = (west + east) / 2;
      
      // Approximate conversion from degrees to pixels
      // 1 degree of latitude is ~111km = 111,000 meters.
      // The croquis system uses 10 pixels = 1 meter.
      // So 1 degree = 1,110,000 pixels.
      const scaleY = -1110000; 
      const scaleX = 1110000 * Math.cos(centerLat * Math.PI / 180);
      
      // 1. Process explicit polygons (landuse, building, city_block)
      data.elements.forEach((el: any) => {
        if (el.type === 'way' && el.nodes && el.nodes.length >= 3 && !el.tags?.highway) {
          // Check if it's a closed way (polygon)
          if (el.nodes[0] === el.nodes[el.nodes.length - 1]) {
            const points: number[] = [];
            let valid = true;
            
            el.nodes.forEach((nodeId: number) => {
              const node = nodes.get(nodeId);
              if (node) {
                const x = (node.lon - centerLon) * scaleX;
                const y = (node.lat - centerLat) * scaleY;
                points.push(x, y);
              } else {
                valid = false;
              }
            });
            
            if (valid) {
              newElements.push({
                id: `manzana-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'manzana',
                points,
                data: {
                  label: el.tags?.name || 'Manzana Importada',
                  blockNumber: ''
                },
                style: {
                  fill: 'rgba(255, 165, 0, 0.3)',
                  stroke: 'rgba(255, 140, 0, 0.8)',
                  strokeWidth: 2
                }
              });
            }
          }
        }
      });

      // 2. Process highways to generate city blocks
      const lines: any[] = [];
      data.elements.forEach((el: any) => {
        if (el.type === 'way' && el.nodes && el.tags?.highway) {
          const coords = el.nodes.map((n: number) => {
            const node = nodes.get(n);
            return node ? [node.lon, node.lat] : null;
          }).filter(Boolean);
          
          if (coords.length >= 2) {
            lines.push(turf.lineString(coords as any));
          }
        }
      });

      if (lines.length > 0) {
        try {
          const fc = turf.featureCollection(lines);
          const polygons = turf.polygonize(fc as any);
          
          polygons.features.forEach((p: any) => {
            // Buffer inwards by 2 meters to create a gap between blocks (like real streets)
            try {
              const buffered = turf.buffer(p, -2, { units: 'meters' });
              const polyToUse = buffered || p; // Fallback to original if buffer fails or eliminates polygon
              
              if (polyToUse && polyToUse.geometry && polyToUse.geometry.coordinates && polyToUse.geometry.coordinates[0]) {
                const ring = polyToUse.geometry.coordinates[0];
                const points: number[] = [];
                
                ring.forEach((coord: number[]) => {
                  const x = (coord[0] - centerLon) * scaleX;
                  const y = (coord[1] - centerLat) * scaleY;
                  points.push(x, y);
                });
                
                newElements.push({
                  id: `manzana-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: 'manzana',
                  points,
                  data: {
                    label: 'Manzana',
                    blockNumber: ''
                  },
                  style: {
                    fill: 'rgba(255, 165, 0, 0.3)',
                    stroke: 'rgba(255, 140, 0, 0.8)',
                    strokeWidth: 2
                  }
                });
              }
            } catch (e) {
              console.warn("Buffer failed for a polygon", e);
            }
          });
        } catch (e) {
          console.error("Polygonize failed", e);
        }
      }
      
      if (newElements.length === 0) {
        setError('No se encontraron manzanas en esta área. Intenta alejar el mapa o buscar otra zona.');
      } else {
        onImport(newElements);
        onClose();
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al importar datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[tw`absolute inset-0 bg-black/50 z-50 items-center justify-center`, { position: 'absolute' as any }]}>
      <View style={tw`bg-white rounded-xl w-11/12 max-w-4xl h-5/6 overflow-hidden flex-col`}>
        <View style={tw`flex-row justify-between items-center p-4 border-b border-gray-200`}>
          <Text style={tw`text-lg font-bold text-gray-800`}>Importar Manzanas desde Mapa</Text>
          <TouchableOpacity onPress={onClose} style={tw`p-2`}>
            <X size={24} color="#4b5563" />
          </TouchableOpacity>
        </View>
        
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer 
            center={[19.4326, -99.1332]} // Default to CDMX, user can pan
            zoom={15} 
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsTracker onBoundsChange={setBounds} />
          </MapContainer>
          
          <View style={tw`absolute top-4 left-0 right-0 items-center pointer-events-none z-[1000]`}>
            <View style={tw`bg-white/90 px-4 py-2 rounded-full shadow-md`}>
              <Text style={tw`text-sm font-medium text-gray-700`}>
                Ubica el mapa en la zona deseada y presiona Importar
              </Text>
            </View>
          </View>
        </div>
        
        <View style={tw`p-4 border-t border-gray-200 bg-gray-50 flex-row justify-between items-center`}>
          <View style={tw`flex-1 mr-4`}>
            {error ? (
              <Text style={tw`text-red-500 text-sm`}>{error}</Text>
            ) : (
              <Text style={tw`text-gray-500 text-sm`}>
                Se importarán las manzanas visibles en el área actual.
              </Text>
            )}
          </View>
          
          <TouchableOpacity 
            onPress={handleImport}
            disabled={loading}
            style={tw`bg-blue-600 px-6 py-3 rounded-lg flex-row items-center justify-center shadow-sm ${loading ? 'opacity-50' : ''}`}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" style={tw`mr-2`} />
            ) : (
              <DownloadCloud size={20} color="white" style={tw`mr-2`} />
            )}
            <Text style={tw`text-white font-bold`}>
              {loading ? 'Importando...' : 'Importar Manzanas'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
