import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Image } from "react-native";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Send, Smartphone, Save, History, Printer } from "lucide-react";
import tw from "twrnc";
import { api } from "../lib/api";
import { useLoading } from "../contexts/LoadingContext";
import HistorialConsolidados from "./HistorialConsolidados";

interface ConsolidadoData {
  fecha: string;
  
  // ACTIVIDAD DE FUMIGACION
  viviendasFumigadas: string;
  viviendasCerradasFumigacion: string;
  viviendasRenuentesFumigacion: string;
  viviendasDeshabitadaFumigacion: string;
  viviendasRecuperadasFumigacion: string;
  escuelasVisitadasFumigacion: string;
  manzanasFumigadas: string;
  habitantesProtegidos: string;
  puntosClavesFumigados: string;
  cipermetrinaGastada: string;

  // ACTIVIDAD DE APLICACION
  viviendasInspeccionadas: string;
  viviendasTratadas: string;
  viviendasPositivas: string;
  viviendasCerradasAplicacion: string;
  viviendasDeshabitadasAplicacion: string;
  viviendasRenuentesAplicacion: string;
  viviendasRecuperadas: string;
  escuelasVisitadas: string;
  totalViviendasVisitadas: string;
  puntosClaveTratados: string;

  // DEPOSITOS
  depositosEliminados: string;
  depositosCepillados: string;
  depositosTratados: string;
  depositosInspeccionados: string;
  depositosPositivos: string;
  abateKgUtilizado: string;
}

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitialData = (): ConsolidadoData => ({
  fecha: getLocalDateString(),
  
  viviendasFumigadas: "",
  viviendasCerradasFumigacion: "",
  viviendasRenuentesFumigacion: "",
  viviendasDeshabitadaFumigacion: "",
  viviendasRecuperadasFumigacion: "",
  escuelasVisitadasFumigacion: "",
  manzanasFumigadas: "",
  habitantesProtegidos: "",
  puntosClavesFumigados: "",
  cipermetrinaGastada: "",

  viviendasInspeccionadas: "",
  viviendasTratadas: "",
  viviendasPositivas: "",
  viviendasCerradasAplicacion: "",
  viviendasDeshabitadasAplicacion: "",
  viviendasRenuentesAplicacion: "",
  viviendasRecuperadas: "",
  escuelasVisitadas: "",
  totalViviendasVisitadas: "",
  puntosClaveTratados: "",

  depositosEliminados: "",
  depositosCepillados: "",
  depositosTratados: "",
  depositosInspeccionados: "",
  depositosPositivos: "",
  abateKgUtilizado: "",
});

export default function Consolidado() {
  const [data, setData] = useState<ConsolidadoData>(getInitialData());
  const [showHistory, setShowHistory] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<{ isConnected: boolean; qrCode: string | null; error?: string | null }>({ isConnected: false, qrCode: null });
  const [showQR, setShowQR] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState("+505");
  const { setLoading } = useLoading();

  useEffect(() => {
    if (Platform.OS === 'web') {
      const savedPhone = localStorage.getItem('recipientPhone');
      if (savedPhone) {
        setRecipientPhone(savedPhone);
      }
    }
    
    let interval: any;
    const checkWhatsappStatus = async () => {
      try {
        const res = await fetch(`/api/whatsapp/status?t=${Date.now()}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const statusData = await res.json();
        setWhatsappStatus(statusData);
        if (statusData.isConnected) {
          setShowQR(false);
        }
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

  const handleConnect = async () => {
    try {
      setLoading(true, "Generando QR...");
      await fetch('/api/whatsapp/connect', { method: 'POST' });
      const res = await fetch(`/api/whatsapp/status?t=${Date.now()}`);
      const statusData = await res.json();
      setWhatsappStatus(statusData);
    } catch (error) {
      console.error("Error connecting:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true, "Desvinculando...");
      await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      setWhatsappStatus({ isConnected: false, qrCode: null });
    } catch (error) {
      console.error("Error disconnecting:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof ConsolidadoData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handlePrint = () => {
    if (Platform.OS === 'web') {
      const element = document.getElementById('consolidado-receipt');
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

  const handleSubmit = async () => {
    setLoading(true, "Procesando...");
    try {
      // 1. Guardar en la base de datos
      await api.addConsolidado(data);

      // 2. Si hay WhatsApp conectado y destinatario, generar imagen y enviar
      if (whatsappStatus.isConnected && recipientPhone) {
        setLoading(true, "Generando imagen...");
        const element = document.getElementById('consolidado-receipt');
        if (element && Platform.OS === 'web') {
          const html2canvas = (await import('html2canvas')).default;
          const canvas = await html2canvas(element, { 
            scale: 2,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
              const clonedElement = clonedDoc.getElementById('consolidado-receipt');
              if (clonedElement && clonedElement.parentElement) {
                clonedElement.parentElement.style.opacity = '1';
              }
            }
          });
          const base64Image = canvas.toDataURL('image/png');

          setLoading(true, "Enviando por WhatsApp...");
          const message = `*CONSOLIDADO DE ACTIVIDADES*\nFecha: ${data.fecha}\n\nAdjunto el consolidado en formato de imagen.`;
          
          const res = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: recipientPhone,
              message,
              image: base64Image
            })
          });

          const result = await res.json();
          if (result.success) {
            alert("Consolidado guardado y enviado exitosamente por WhatsApp");
          } else {
            alert("Consolidado guardado, pero hubo un error al enviar WhatsApp: " + result.error);
          }
        } else {
          // Fallback for mobile: send text only
          setLoading(true, "Enviando por WhatsApp...");
          const message = `*CONSOLIDADO DE ACTIVIDADES*\nFecha: ${data.fecha}\n\n(La imagen del consolidado solo se puede generar en la versión web).`;
          
          const res = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: recipientPhone,
              message
            })
          });

          const result = await res.json();
          if (result.success) {
            alert("Consolidado guardado y enviado exitosamente por WhatsApp");
          } else {
            alert("Consolidado guardado, pero hubo un error al enviar WhatsApp: " + result.error);
          }
        }
      } else {
        alert("Consolidado guardado exitosamente" + (!whatsappStatus.isConnected ? " (WhatsApp no conectado)" : " (Sin destinatario)"));
      }
      
      setData(getInitialData()); // Reset form
    } catch (error) {
      console.error("Error:", error);
      alert("Error al procesar la solicitud");
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (label: string, field: keyof ConsolidadoData) => (
    <View style={tw`flex-row items-center justify-between border-b border-gray-200 py-2`}>
      <Text style={tw`text-sm text-gray-700 flex-1 pr-2`}>{label}</Text>
      <TextInput
        style={tw`border border-gray-300 rounded-md px-3 py-1 w-20 text-center bg-white`}
        keyboardType="numeric"
        value={data[field]}
        onChangeText={(val) => {
          const numericValue = val.replace(/[^0-9.]/g, '');
          handleChange(field, numericValue);
        }}
        placeholder="0"
      />
    </View>
  );

  if (showHistory) {
    return <HistorialConsolidados onClose={() => setShowHistory(false)} />;
  }

  return (
    <View style={tw`flex-1 bg-gray-50`}>
      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`p-6`}>
        <View style={tw`flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6`}>
          <Text style={tw`text-2xl font-bold text-gray-900`}>Consolidado Estadístico</Text>
          <TouchableOpacity onPress={() => setShowHistory(true)} style={tw`bg-blue-100 px-4 py-2 rounded-lg flex-row items-center`}>
            <History size={20} color="#0284c7" style={tw`mr-2`} />
            <Text style={tw`text-blue-700 font-bold`}>Ver Historial</Text>
          </TouchableOpacity>
        </View>

      <View style={tw`bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6`}>
        <View style={tw`flex-col sm:flex-row gap-6`}>
          <View style={tw`flex-1 max-w-sm`}>
            <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Fecha</Text>
            <View style={tw`flex-row items-center border border-gray-300 rounded-lg px-3 py-2 bg-gray-50`}>
              <CalendarIcon size={20} color="#6b7280" style={tw`mr-2`} />
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  style={{
                    flex: 1,
                    border: 'none',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    color: '#111827',
                    fontSize: '16px'
                  }}
                  value={data.fecha}
                  onChange={(e) => handleChange('fecha', e.target.value)}
                />
              ) : (
                <TextInput
                  style={tw`flex-1 text-gray-900`}
                  value={data.fecha}
                  onChangeText={(val) => handleChange('fecha', val)}
                  placeholder="YYYY-MM-DD"
                />
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={tw`bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6`}>
        <View style={tw`flex-row justify-between items-center mb-4`}>
          <Text style={tw`text-lg font-bold text-gray-900 flex-row items-center`}>
            <Smartphone size={20} color="#10b981" style={tw`mr-2`} />
            Envío por WhatsApp
          </Text>
          <View style={tw`flex-row items-center`}>
            <View style={tw`w-3 h-3 rounded-full mr-2 ${whatsappStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <Text style={tw`text-sm text-gray-600 font-medium mr-4`}>
              {whatsappStatus.isConnected ? 'Conectado' : 'Desconectado'}
            </Text>
            {whatsappStatus.isConnected ? (
              <TouchableOpacity onPress={handleDisconnect} style={tw`bg-red-100 px-3 py-1 rounded-md ml-4`}>
                <Text style={tw`text-red-600 text-xs font-bold`}>Desvincular</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setShowQR(!showQR)} style={tw`bg-blue-100 px-3 py-1 rounded-md`}>
                <Text style={tw`text-blue-600 text-xs font-bold`}>{showQR ? 'Ocultar QR' : 'Vincular WhatsApp'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!whatsappStatus.isConnected && showQR && (
          <View style={tw`items-center mb-4 p-6 bg-gray-50 rounded-lg border border-gray-200`}>
            <Text style={tw`text-base text-gray-800 mb-4 font-medium text-center`}>
              Para enviar mensajes automáticamente, vincula tu cuenta de WhatsApp.
            </Text>
            {whatsappStatus.error && (
              <View style={tw`items-center mb-4`}>
                <Text style={tw`text-sm text-red-500 mb-2 text-center font-bold`}>
                  Error: {whatsappStatus.error}
                </Text>
                <TouchableOpacity onPress={handleConnect} style={tw`bg-blue-600 px-4 py-2 rounded-lg`}>
                  <Text style={tw`text-white font-bold text-sm`}>Generar nuevo QR</Text>
                </TouchableOpacity>
              </View>
            )}
            {whatsappStatus.qrCode ? (
              <>
                <Text style={tw`text-sm text-gray-600 mb-4 text-center`}>
                  1. Abre WhatsApp en tu celular{'\n'}
                  2. Toca Menú o Configuración y selecciona Dispositivos vinculados{'\n'}
                  3. Toca Vincular un dispositivo y escanea este código QR
                </Text>
                <View style={tw`bg-white p-2 rounded-xl shadow-sm border border-gray-100`}>
                  <Image source={{ uri: whatsappStatus.qrCode }} style={{ width: 220, height: 220 }} />
                </View>
              </>
            ) : !whatsappStatus.error ? (
              <Text style={tw`text-sm text-gray-500 italic`}>Generando código QR...</Text>
            ) : null}
          </View>
        )}

        <View style={tw`flex-col sm:flex-row gap-4 items-stretch sm:items-end`}>
          {whatsappStatus.isConnected && (
            <View style={tw`flex-1`}>
              <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Número de Destinatario</Text>
              <View style={tw`flex-row items-center border border-gray-300 rounded-lg bg-gray-50 overflow-hidden`}>
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
            </View>
          )}
          <View style={tw`flex-row gap-2 w-full sm:w-auto`}>
            <TouchableOpacity
              style={tw`bg-gray-600 px-4 py-2.5 rounded-lg flex-row items-center justify-center h-[42px] flex-1 sm:flex-none`}
              onPress={handlePrint}
            >
              <Printer size={20} color="#fff" style={tw`mr-2`} />
              <Text style={tw`text-white font-medium`}>Imprimir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={tw`bg-blue-600 px-6 py-2.5 rounded-lg flex-row items-center justify-center h-[42px] flex-1 sm:flex-none ${!whatsappStatus.isConnected ? 'w-full' : ''}`}
              onPress={handleSubmit}
            >
              {whatsappStatus.isConnected ? (
                <>
                  <Send size={20} color="#fff" style={tw`mr-2`} />
                  <Text style={tw`text-white font-medium`}>Enviar</Text>
                </>
              ) : (
                <>
                  <Save size={20} color="#fff" style={tw`mr-2`} />
                  <Text style={tw`text-white font-medium`}>Guardar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={tw`flex-col lg:flex-row gap-6`}>
        {/* Column 1: FUMIGACION */}
        <View style={tw`flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden`}>
          <View style={tw`bg-blue-50 px-4 py-3 border-b border-blue-100`}>
            <Text style={tw`font-bold text-blue-900 text-center`}>ACTIVIDAD DE FUMIGACION</Text>
          </View>
          <View style={tw`p-4`}>
            {renderInput("Viviendas Fumigadas", "viviendasFumigadas")}
            {renderInput("Viviendas Cerradas", "viviendasCerradasFumigacion")}
            {renderInput("Viviendas Renuentes", "viviendasRenuentesFumigacion")}
            {renderInput("Viviendas Deshabitada", "viviendasDeshabitadaFumigacion")}
            {renderInput("Viviendas Recuperadas", "viviendasRecuperadasFumigacion")}
            {renderInput("Escuelas Visitadas", "escuelasVisitadasFumigacion")}
            {renderInput("Manzanas Fumigadas", "manzanasFumigadas")}
            {renderInput("Habitantes Protegidos", "habitantesProtegidos")}
            {renderInput("Puntos Claves Fumigados", "puntosClavesFumigados")}
            {renderInput("Cipermetrina Gastada", "cipermetrinaGastada")}
          </View>
        </View>

        {/* Column 2: APLICACION */}
        <View style={tw`flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden`}>
          <View style={tw`bg-green-50 px-4 py-3 border-b border-green-100`}>
            <Text style={tw`font-bold text-green-900 text-center`}>ACTIVIDAD DE APLICACION</Text>
          </View>
          <View style={tw`p-4`}>
            {renderInput("Viviendas Inspeccionadas", "viviendasInspeccionadas")}
            {renderInput("Viviendas Tratadas", "viviendasTratadas")}
            {renderInput("Viviendas Positivas", "viviendasPositivas")}
            {renderInput("Viviendas Cerradas", "viviendasCerradasAplicacion")}
            {renderInput("Viviendas Desabitadas", "viviendasDeshabitadasAplicacion")}
            {renderInput("Viviendas Renuentes", "viviendasRenuentesAplicacion")}
            {renderInput("Viviendas Recuperadas", "viviendasRecuperadas")}
            {renderInput("Escuelas Visitadas", "escuelasVisitadas")}
            {renderInput("Total de Viviendas Visitadas", "totalViviendasVisitadas")}
            {renderInput("Puntos clave Tratados", "puntosClaveTratados")}
          </View>
        </View>

        {/* Column 3: DEPOSITOS */}
        <View style={tw`flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden`}>
          <View style={tw`bg-orange-50 px-4 py-3 border-b border-orange-100`}>
            <Text style={tw`font-bold text-orange-900 text-center`}>DEPOSITOS</Text>
          </View>
          <View style={tw`p-4`}>
            {renderInput("Depósitos Eliminados", "depositosEliminados")}
            {renderInput("Depósitos Cepillados", "depositosCepillados")}
            {renderInput("Depósitos Tratados", "depositosTratados")}
            {renderInput("Depósitos Inspeccionados", "depositosInspeccionados")}
            {renderInput("Depósitos Positivos", "depositosPositivos")}
            {renderInput("Abate en Kg Utilizado", "abateKgUtilizado")}
          </View>
        </View>
      </View>

      </ScrollView>

      {Platform.OS === 'web' && (
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: -1000, opacity: 0.01, pointerEvents: 'none' }}>
          <div id="consolidado-receipt" style={{ width: '800px', backgroundColor: '#ffffff', padding: '40px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}>CONSOLIDADO DE ACTIVIDADES</h2>
          <div style={{ marginBottom: '20px', fontSize: '14px' }}>
            <p><strong>Fecha:</strong> {data.fecha ? format(new Date(data.fecha), "dd 'de' MMMM, yyyy", { locale: es }) : ''}</p>
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
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '8%' }}>{data.viviendasFumigadas || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', width: '25%' }}>Viviendas Inspeccionadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '8%' }}>{data.viviendasInspeccionadas || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold', width: '25%' }}>Depósitos Eliminados</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', width: '8%' }}>{data.depositosEliminados || '0'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Cerradas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasCerradasFumigacion || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Tratadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasTratadas || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Depósitos Cepillados</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.depositosCepillados || '0'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Renuentes</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasRenuentesFumigacion || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Positivas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasPositivas || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Depósitos Tratados</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.depositosTratados || '0'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Deshabitada</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasDeshabitadaFumigacion || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Cerradas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasCerradasAplicacion || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Depósitos Inspeccionados</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.depositosInspeccionados || '0'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Manzanas Fumigadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.manzanasFumigadas || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Desabitadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasDeshabitadasAplicacion || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Depósitos Positivos</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.depositosPositivos || '0'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Habitantes Protegidos</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.habitantesProtegidos || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Renuentes</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasRenuentesAplicacion || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Abate en Kg Utilizado</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.abateKgUtilizado || '0'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Puntos Claves Fumigados</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.puntosClavesFumigados || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Total de Viviendas Visitadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.totalViviendasVisitadas || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}></td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Cipermetrina Gastada</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.cipermetrinaGastada || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Puntos clave Tratados</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.puntosClaveTratados || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}></td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Recuperadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasRecuperadasFumigacion || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Viviendas Recuperadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.viviendasRecuperadas || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}></td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Escuelas Visitadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.escuelasVisitadasFumigacion || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}>Escuelas Visitadas</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{data.escuelasVisitadas || '0'}</td>
                <td style={{ border: '1px solid #000', padding: '8px', fontWeight: 'bold' }}></td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}></td>
              </tr>
            </tbody>
          </table>
          </div>
          </div>
        </div>
      )}
    </View>
  );
}
