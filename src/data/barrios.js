/**
 * Datos de Barrios y Manzanas para el Croquis Interactivo
 * 
 * CÓMO AGREGAR MÁS BARRIOS:
 * 1. Dibuja tu mapa en Inkscape o Figma.
 * 2. Cada manzana debe ser un "Path" o "Rectángulo" convertido a Path.
 * 3. Copia el atributo 'd' del path SVG.
 * 4. Define el viewBox del SVG original (ancho y alto del lienzo).
 * 5. Agrega una nueva entrada en 'barriosData' con la estructura mostrada abajo.
 * 
 * NOTA: labelX y labelY son las coordenadas aproximadas del centro de la manzana para colocar el número.
 */

export const barriosData = {
  "Pedro Joaquin Chamorro": {
    viewBox: "0 0 400 300",
    manzanas: [
      { id: 1, path: "M20,20 L100,20 L100,80 L20,80 Z", labelX: 60, labelY: 50 },
      { id: 2, path: "M120,20 L200,20 L200,80 L120,80 Z", labelX: 160, labelY: 50 },
      { id: 3, path: "M220,20 L300,20 L300,80 L220,80 Z", labelX: 260, labelY: 50 },
      { id: 4, path: "M20,100 L100,100 L100,160 L20,160 Z", labelX: 60, labelY: 130 },
      { id: 5, path: "M120,100 L200,100 L200,160 L120,160 Z", labelX: 160, labelY: 130 },
      { id: 6, path: "M220,100 L300,100 L300,160 L220,160 Z", labelX: 260, labelY: 130 },
      { id: 7, path: "M20,180 L100,180 L100,240 L20,240 Z", labelX: 60, labelY: 210 },
      { id: 8, path: "M120,180 L200,180 L200,240 L120,240 Z", labelX: 160, labelY: 210 },
      { id: 9, path: "M220,180 L300,180 L300,240 L220,240 Z", labelX: 260, labelY: 210 },
      { id: 10, path: "M320,20 L380,20 L380,80 L320,80 Z", labelX: 350, labelY: 50 },
      { id: 11, path: "M320,100 L380,100 L380,160 L320,160 Z", labelX: 350, labelY: 130 },
      { id: 12, path: "M320,180 L380,180 L380,240 L320,240 Z", labelX: 350, labelY: 210 },
    ]
  },
  "3-80": {
    viewBox: "0 0 300 200",
    manzanas: [
      { id: 1, path: "M10,10 L90,10 L80,90 L20,90 Z", labelX: 50, labelY: 50 }, // Irregular
      { id: 2, path: "M110,10 L190,10 L190,90 L110,90 Z", labelX: 150, labelY: 50 },
      { id: 3, path: "M210,10 L290,10 L290,90 L210,90 Z", labelX: 250, labelY: 50 },
      { id: 4, path: "M10,110 L90,110 L90,190 L10,190 Z", labelX: 50, labelY: 150 },
      { id: 5, path: "M110,110 L190,110 L190,190 L110,190 Z", labelX: 150, labelY: 150 },
      { id: 6, path: "M210,110 L290,110 L290,190 L210,190 Z", labelX: 250, labelY: 150 },
      { id: 7, path: "M100,50 L100,150 L200,150 L200,50 Z", labelX: 150, labelY: 100 }, // Central overlapping example
      { id: 8, path: "M250,50 L280,50 L280,150 L250,150 Z", labelX: 265, labelY: 100 },
    ]
  },
  "Pancasan": {
    viewBox: "0 0 500 400",
    manzanas: [
      { id: 1, path: "M50,50 L150,50 L150,150 L50,150 Z", labelX: 100, labelY: 100 },
      { id: 2, path: "M170,50 L270,50 L270,150 L170,150 Z", labelX: 220, labelY: 100 },
      { id: 3, path: "M290,50 L390,50 L390,150 L290,150 Z", labelX: 340, labelY: 100 },
      { id: 4, path: "M50,170 L150,170 L150,270 L50,270 Z", labelX: 100, labelY: 220 },
      { id: 5, path: "M170,170 L270,170 L270,270 L170,270 Z", labelX: 220, labelY: 220 },
      { id: 6, path: "M290,170 L390,170 L390,270 L290,270 Z", labelX: 340, labelY: 220 },
      { id: 7, path: "M50,290 L150,290 L150,390 L50,390 Z", labelX: 100, labelY: 340 },
      { id: 8, path: "M170,290 L270,290 L270,390 L170,390 Z", labelX: 220, labelY: 340 },
      { id: 9, path: "M290,290 L390,290 L390,390 L290,390 Z", labelX: 340, labelY: 340 },
      { id: 10, path: "M410,50 L480,50 L480,150 L410,150 Z", labelX: 445, labelY: 100 },
      { id: 11, path: "M410,170 L480,170 L480,270 L410,270 Z", labelX: 445, labelY: 220 },
      { id: 12, path: "M410,290 L480,290 L480,390 L410,390 Z", labelX: 445, labelY: 340 },
      { id: 13, path: "M10,10 L40,10 L40,390 L10,390 Z", labelX: 25, labelY: 200 }, // Long vertical
      { id: 14, path: "M50,10 L390,10 L390,40 L50,40 Z", labelX: 220, labelY: 25 }, // Long horizontal
      { id: 15, path: "M410,10 L480,10 L480,40 L410,40 Z", labelX: 445, labelY: 25 },
    ]
  },
  // Barrios adicionales sin datos de mapa para el ejemplo
  "Concepcion N2": { viewBox: "0 0 100 100", manzanas: [] },
  "Concepcion N1": { viewBox: "0 0 100 100", manzanas: [] },
  "Francisco Alvarez": { viewBox: "0 0 100 100", manzanas: [] },
  "Jose Dolores Estrada": { viewBox: "0 0 100 100", manzanas: [] },
  "Ramon Obando": { viewBox: "0 0 100 100", manzanas: [] },
  "Rigoberto Lopez Peres": { viewBox: "0 0 100 100", manzanas: [] },
  "Gaspar Garcia": { viewBox: "0 0 100 100", manzanas: [] },
  "San Martin": { viewBox: "0 0 100 100", manzanas: [] },
};
