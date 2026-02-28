import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './', // Permite que Electron cargue los archivos locales correctamente
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // React Native Web relies on this
      'global': 'window', 
      '__DEV__': JSON.stringify(mode !== 'production'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react-native': 'react-native-web',
        'react-native/Libraries/Utilities/codegenNativeComponent': 'react-native-web/dist/exports/View',
        'react-native/Libraries/Image/AssetSourceResolver': 'react-native-web/dist/modules/AssetSourceResolver',
        'react-native/Libraries/Image/resolveAssetSource': 'react-native-web/dist/modules/AssetSourceResolver',
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
