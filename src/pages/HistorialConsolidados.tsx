import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Platform, TextInput } from "react-native";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2, FileSpreadsheet, Calendar, ArrowLeft, Clock, ChevronRight, Send, Printer } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";
import { useLoading } from "../contexts/LoadingContext";

const getApiUrl = (path: string) => {
  if (typeof window !== 'undefined' && window.location && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    if (window.location.port === '8081') {
      return `http://${window.location.hostname}:3000${path}`;
    }
    return `${window.location.origin}${path}`;
  }
  return `http://10.0.2.2:3000${path}`;
};

export default function HistorialConsolidados({ onClose }: { onClose?: () => void }) {
  const { setLoading } = useLoading();
  const [consolidados, setConsolidados] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<{ isConnected: boolean; qrCode: string | null; error?: string | null }>({ isConnected: false, qrCode: null });
  const [recipientPhone, setRecipientPhone] = useState("+505");

  useEffect(() => {
    fetchData();
    
    if (Platform.OS === 'web') {
      const savedPhone = localStorage.getItem('recipientPhone');
      if (savedPhone) {
        setRecipientPhone(savedPhone);
      }
    }
    
    let interval: any;
    const checkWhatsappStatus = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/whatsapp/status?t=${Date.now()}`));
        if (!res.ok) throw new Error('Network response was not ok');
        const text = await res.text();
        let statusData;
        try {
          statusData = JSON.parse(text);
        } catch (e) {
          throw new Error(`Respuesta inválida del servidor: ${text.substring(0, 100)}...`);
        }
        setWhatsappStatus(statusData);
      } catch (error) {
        console.error("Error fetching WhatsApp status:", error);
        setWhatsappStatus(prev => ({
          ...prev,
          isConnected: false,
          error: "No se pudo conectar al servidor. Reintentando..."
        }));
      }
    };

    checkWhatsappStatus();
    interval = setInterval(checkWhatsappStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setIsFetching(true);
    try {
      const data = await api.getConsolidados();
      setConsolidados(data);
    } catch (error) {
      console.error("Error fetching consolidados:", error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      setLoading(true, 'Eliminando consolidado...');
      await api.deleteConsolidado(itemToDelete);
      await fetchData();
      setItemToDelete(null);
      setLoading(false);
    }
  };

  const cancelDelete = () => {
    setItemToDelete(null);
  };

  const handlePrint = () => {
    if (Platform.OS === 'web') {
      const element = document.getElementById('consolidado-receipt-history');
      if (element) {
        const printContainer = document.createElement('div');
        printContainer.id = 'print-container';
        printContainer.innerHTML = element.innerHTML;
        
        const style = document.createElement('style');
        style.id = 'print-style';
        style.innerHTML = `
          @media print {
            #root { display: none !important; }
            body { background-color: white !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { margin: 0.5cm; }
            #print-container {
              display: block !important;
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            #print-container table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            #print-container th, #print-container td { border: 1px solid #000; padding: 8px; text-align: left; }
            #print-container th { background-color: #f3f4f6; text-align: center; }
            #print-container h2 { text-align: center; }
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
        }, 100);
      } else {
        alert("No se encontró el elemento a imprimir.");
      }
    } else {
      alert("La impresión solo está disponible en la versión web/escritorio.");
    }
  };

  const handleResend = async () => {
    if (!whatsappStatus.isConnected) {
      alert("WhatsApp no está conectado. Ve a la pestaña de Consolidado para vincularlo.");
      return;
    }
    if (!recipientPhone) {
      alert("Ingresa un número de destinatario.");
      return;
    }

    setLoading(true, "Generando imagen...");
    try {
      const element = document.getElementById('consolidado-receipt-history');
      if (element && Platform.OS === 'web') {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(element, { 
          scale: 2,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const clonedElement = clonedDoc.getElementById('consolidado-receipt-history');
            if (clonedElement && clonedElement.parentElement) {
              clonedElement.parentElement.style.opacity = '1';
            }
          }
        });
        const base64Image = canvas.toDataURL('image/png');

        setLoading(true, "Enviando por WhatsApp...");
        const message = `*CONSOLIDADO DE ACTIVIDADES (Reenvío)*\nFecha: ${selectedItem.fecha}\n\nAdjunto el consolidado en formato de imagen.`;
        
        const res = await fetch(getApiUrl('/api/whatsapp/send'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: recipientPhone,
            message,
            image: base64Image
          })
        });

        const text = await res.text();
        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          throw new Error(`Respuesta inválida del servidor al enviar: ${text.substring(0, 100)}...`);
        }
        if (result.success) {
          alert("Consolidado reenviado exitosamente por WhatsApp");
        } else {
          alert("Hubo un error al enviar WhatsApp: " + result.error);
        }
      } else {
        // Fallback for mobile
        setLoading(true, "Enviando por WhatsApp...");
        const message = `*CONSOLIDADO DE ACTIVIDADES (Reenvío)*\nFecha: ${selectedItem.fecha}\n\n(La imagen del consolidado solo se puede generar en la versión web).`;
        
        const res = await fetch(getApiUrl('/api/whatsapp/send'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: recipientPhone,
            message
          })
        });

        const text2 = await res.text();
        let result2;
        try {
          result2 = JSON.parse(text2);
        } catch (e) {
          throw new Error(`Respuesta inválida del servidor al enviar: ${text2.substring(0, 100)}...`);
        }
        if (result2.success) {
          alert("Consolidado reenviado exitosamente por WhatsApp");
        } else {
          alert("Hubo un error al enviar WhatsApp: " + result2.error);
        }
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al reenviar");
    } finally {
      setLoading(false);
    }
  };

  const renderDetailView = () => {
    if (!selectedItem) return null;
    
    const renderRow = (label: string, value: string) => (
      <View style={tw`flex-row items-center justify-between border-b border-gray-100 py-3`}>
        <Text style={tw`text-sm text-gray-700 flex-1 pr-2`}>{label}</Text>
        <View style={tw`border border-gray-300 rounded-md px-3 py-1 w-20 bg-white items-center`}>
          <Text style={tw`text-gray-900 font-medium`}>{value || "0"}</Text>
        </View>
      </View>
    );

    return (
      <View style={tw`flex-1 p-4 bg-gray-50`}>
        <View style={tw`flex-row justify-between items-center mb-6 shrink-0`}>
          <View style={tw`flex-row items-center`}>
            <TouchableOpacity onPress={() => setSelectedItem(null)} style={tw`mr-3 p-2 bg-gray-200 rounded-full`}>
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
            <View>
              <Text style={tw`text-xl font-bold text-gray-800`}>Detalle de Consolidado</Text>
              <Text style={tw`text-sm text-gray-500`}>
                {selectedItem.createdAt ? format(new Date(selectedItem.createdAt), "dd MMM yyyy, hh:mm a", { locale: es }) : selectedItem.fecha}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`}>
          {/* WhatsApp Resend Section */}
          <View style={tw`bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
            <View style={tw`flex-1 mr-4`}>
              <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Reenviar por WhatsApp</Text>
              {whatsappStatus.isConnected ? (
                <View style={tw`flex-row items-center border border-gray-300 rounded-lg bg-gray-50 overflow-hidden max-w-[250px]`}>
                  <View style={tw`bg-gray-200 px-3 py-2 border-r border-gray-300`}>
                    <Text style={tw`text-gray-700 font-medium`}>+505</Text>
                  </View>
                  <TextInput
                    style={tw`flex-1 px-3 py-2 text-gray-900`}
                    value={recipientPhone.replace(/^\+505/, '')}
                    onChangeText={(val) => {
                      const newPhone = '+505' + val.replace(/[^0-9]/g, '');
                      setRecipientPhone(newPhone);
                      if (Platform.OS === 'web') {
                        localStorage.setItem('recipientPhone', newPhone);
                      }
                    }}
                    placeholder="12345678"
                    keyboardType="phone-pad"
                  />
                </View>
              ) : (
                <Text style={tw`text-sm text-red-500`}>WhatsApp no conectado. Ve a la pestaña principal para vincularlo.</Text>
              )}
            </View>
            <View style={tw`flex-row gap-2 w-full sm:w-auto justify-end`}>
              <TouchableOpacity
                style={tw`bg-gray-600 px-4 py-2 rounded-lg flex-row items-center justify-center h-[40px] flex-1 sm:flex-none`}
                onPress={handlePrint}
              >
                <Printer size={18} color="#fff" style={tw`mr-2`} />
                <Text style={tw`text-white font-medium`}>Imprimir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`bg-green-600 px-4 py-2 rounded-lg flex-row items-center justify-center h-[40px] flex-1 sm:flex-none ${!whatsappStatus.isConnected ? 'opacity-50' : ''}`}
                onPress={handleResend}
                disabled={!whatsappStatus.isConnected}
              >
                <Send size={18} color="#fff" style={tw`mr-2`} />
                <Text style={tw`text-white font-medium`}>Reenviar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={tw`flex-row flex-wrap gap-6`}>
            {/* Column 1: FUMIGACION */}
            <View style={tw`flex-1 min-w-[300px] bg-white rounded-xl shadow-sm border border-blue-100 overflow-hidden`}>
              <View style={tw`bg-blue-50 px-4 py-3 border-b border-blue-100`}>
                <Text style={tw`font-bold text-blue-900 text-center`}>ACTIVIDAD DE FUMIGACION</Text>
              </View>
              <View style={tw`p-4`}>
                {renderRow("Viviendas Fumigadas", selectedItem.viviendasFumigadas)}
                {renderRow("Viviendas Cerradas", selectedItem.viviendasCerradasFumigacion)}
                {renderRow("Viviendas Renuentes", selectedItem.viviendasRenuentesFumigacion)}
                {renderRow("Viviendas Deshabitada", selectedItem.viviendasDeshabitadaFumigacion)}
                {renderRow("Viviendas Recuperadas", selectedItem.viviendasRecuperadasFumigacion)}
                {renderRow("Escuelas Visitadas", selectedItem.escuelasVisitadasFumigacion)}
                {renderRow("Manzanas Fumigadas", selectedItem.manzanasFumigadas)}
                {renderRow("Habitantes Protegidos", selectedItem.habitantesProtegidos)}
                {renderRow("Puntos Claves Fumigados", selectedItem.puntosClavesFumigados)}
                {renderRow("Cipermetrina Gastada", selectedItem.cipermetrinaGastada)}
              </View>
            </View>

            {/* Column 2: APLICACION */}
            <View style={tw`flex-1 min-w-[300px] bg-white rounded-xl shadow-sm border border-green-100 overflow-hidden`}>
              <View style={tw`bg-green-50 px-4 py-3 border-b border-green-100`}>
                <Text style={tw`font-bold text-green-900 text-center`}>ACTIVIDAD DE APLICACION</Text>
              </View>
              <View style={tw`p-4`}>
                {renderRow("Viviendas Inspeccionadas", selectedItem.viviendasInspeccionadas)}
                {renderRow("Viviendas Tratadas", selectedItem.viviendasTratadas)}
                {renderRow("Viviendas Positivas", selectedItem.viviendasPositivas)}
                {renderRow("Viviendas Cerradas", selectedItem.viviendasCerradasAplicacion)}
                {renderRow("Viviendas Desabitadas", selectedItem.viviendasDeshabitadasAplicacion)}
                {renderRow("Viviendas Renuentes", selectedItem.viviendasRenuentesAplicacion)}
                {renderRow("Viviendas Recuperadas", selectedItem.viviendasRecuperadas)}
                {renderRow("Escuelas Visitadas", selectedItem.escuelasVisitadas)}
                {renderRow("Total de Viviendas Visitadas", selectedItem.totalViviendasVisitadas)}
                {renderRow("Puntos clave Tratados", selectedItem.puntosClaveTratados)}
              </View>
            </View>

            {/* Column 3: DEPOSITOS */}
            <View style={tw`flex-1 min-w-[300px] bg-white rounded-xl shadow-sm border border-orange-100 overflow-hidden`}>
              <View style={tw`bg-orange-50 px-4 py-3 border-b border-orange-100`}>
                <Text style={tw`font-bold text-orange-900 text-center`}>DEPOSITOS</Text>
              </View>
              <View style={tw`p-4`}>
                {renderRow("Depósitos Eliminados", selectedItem.depositosEliminados)}
                {renderRow("Depósitos Cepillados", selectedItem.depositosCepillados)}
                {renderRow("Depósitos Tratados", selectedItem.depositosTratados)}
                {renderRow("Depósitos Inspeccionados", selectedItem.depositosInspeccionados)}
                {renderRow("Depósitos Positivos", selectedItem.depositosPositivos)}
                {renderRow("Abate en Kg Utilizado", selectedItem.abateKgUtilizado)}
              </View>
            </View>
          </View>

          {Platform.OS === 'web' && selectedItem && (
            <div style={{ position: 'absolute', top: 0, left: 0, zIndex: -1000, opacity: 0.01, pointerEvents: 'none' }}>
              <div id="consolidado-receipt-history" style={{ width: '800px', backgroundColor: '#ffffff', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}>CONSOLIDADO DE ACTIVIDADES</h2>
              <div style={{ marginBottom: '20px', fontSize: '14px' }}>
                <p><strong>Fecha:</strong> {selectedItem.fecha ? format(new Date(selectedItem.fecha), "dd 'de' MMMM, yyyy", { locale: es }) : ''}</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f3f4f6', textAlign: 'center', fontWeight: 'bold' }}>ACTIVIDAD DE FUMIGACION</th>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f3f4f6', textAlign: 'center', fontWeight: 'bold' }}>ACTIVIDAD DE APLICACION</th>
                    <th colSpan={2} style={{ border: '1px solid #000', padding: '8px', backgroundColor: '#f3f4f6', textAlign: 'center', fontWeight: 'bold' }}>DEPOSITOS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', width: '25%' }}>Viviendas Fumigadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '8%' }}>{selectedItem.viviendasFumigadas || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', width: '25%' }}>Viviendas Inspeccionadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '8%' }}>{selectedItem.viviendasInspeccionadas || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', width: '25%' }}>Depósitos Eliminados</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '8%' }}>{selectedItem.depositosEliminados || '0'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Cerradas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasCerradasFumigacion || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Tratadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasTratadas || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Depósitos Cepillados</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.depositosCepillados || '0'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Renuentes</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasRenuentesFumigacion || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Positivas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasPositivas || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Depósitos Tratados</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.depositosTratados || '0'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Deshabitada</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasDeshabitadaFumigacion || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Cerradas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasCerradasAplicacion || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Depósitos Inspeccionados</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.depositosInspeccionados || '0'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Manzanas Fumigadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.manzanasFumigadas || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Desabitadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasDeshabitadasAplicacion || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Depósitos Positivos</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.depositosPositivos || '0'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Habitantes Protegidos</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.habitantesProtegidos || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Renuentes</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasRenuentesAplicacion || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Abate en Kg Utilizado</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.abateKgUtilizado || '0'}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Puntos Claves Fumigados</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.puntosClavesFumigados || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Total de Viviendas Visitadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.totalViviendasVisitadas || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}></td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Cipermetrina Gastada</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.cipermetrinaGastada || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Puntos clave Tratados</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.puntosClaveTratados || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}></td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Recuperadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasRecuperadasFumigacion || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Recuperadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.viviendasRecuperadas || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}></td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Escuelas Visitadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.escuelasVisitadasFumigacion || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Escuelas Visitadas</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{selectedItem.escuelasVisitadas || '0'}</td>
                    <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}></td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
                  </tr>
                </tbody>
              </table>
              </div>
              </div>
            </div>
          )}
        </ScrollView>
      </View>
    );
  };

  if (selectedItem) {
    return renderDetailView();
  }

  return (
    <View style={tw`flex-1 p-4 bg-gray-50`}>
      <View style={tw`flex-row justify-between items-center mb-6 shrink-0`}>
        <View style={tw`flex-row items-center`}>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={tw`mr-3 p-2 bg-gray-200 rounded-full`}>
              <ArrowLeft size={20} color="#374151" />
            </TouchableOpacity>
          )}
          <Text style={tw`text-2xl font-bold text-gray-800`}>Historial de Consolidados</Text>
        </View>
        <Text style={tw`text-sm text-gray-500`}>{consolidados.length} registros</Text>
      </View>

      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-8`}>
        <View style={tw`gap-3`}>
          {isFetching ? (
            <Text style={tw`text-center text-gray-500 py-8`}>Cargando...</Text>
          ) : consolidados.length === 0 ? (
            <View style={tw`items-center py-12 bg-white rounded-xl border border-dashed border-gray-200`}>
              <FileSpreadsheet color="#d1d5db" size={48} style={tw`mb-2`} />
              <Text style={tw`text-gray-500`}>No hay consolidados registrados</Text>
            </View>
          ) : (
            consolidados.map((item) => (
              <TouchableOpacity 
                key={item.id} 
                style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-row justify-between items-center`}
                onPress={() => setSelectedItem(item)}
              >
                <View style={tw`flex-1`}>
                  <View style={tw`flex-row items-center mb-1`}>
                    <Calendar size={16} color="#6b7280" style={tw`mr-2`} />
                    <Text style={tw`font-bold text-gray-800 text-lg`}>
                      {item.fecha ? format(new Date(item.fecha), "dd MMM yyyy", { locale: es }) : "Sin fecha"}
                    </Text>
                  </View>
                  {item.createdAt && (
                    <View style={tw`flex-row items-center`}>
                      <Clock size={14} color="#9ca3af" style={tw`mr-2`} />
                      <Text style={tw`text-sm text-gray-500`}>
                        Enviado: {format(new Date(item.createdAt), "dd MMM yyyy, hh:mm a", { locale: es })}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={tw`flex-row items-center`}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    style={tw`p-2 bg-red-50 rounded-full mr-3`}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                  <ChevronRight size={20} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <View style={[tw`absolute inset-0 bg-black/50 z-50 items-center justify-center`, { position: 'absolute' as any }]}>
          <View style={tw`bg-white p-6 rounded-xl w-80 shadow-xl`}>
            <Text style={tw`text-lg font-bold text-gray-800 mb-2`}>Eliminar Consolidado</Text>
            <Text style={tw`text-sm text-gray-600 mb-6`}>¿Estás seguro que deseas eliminar este consolidado? Esta acción no se puede deshacer.</Text>
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
