import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import tw from 'twrnc';

interface LoadingContextType {
  isLoading: boolean;
  loadingText: string;
  setLoading: (loading: boolean, text?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Cargando...');

  const setLoading = (loading: boolean, text: string = 'Cargando...') => {
    setIsLoading(loading);
    setLoadingText(text);
  };

  return (
    <LoadingContext.Provider value={{ isLoading, loadingText, setLoading }}>
      {children}
      {isLoading && (
        <View style={[tw`absolute top-0 left-0 right-0 z-50 flex-row justify-center items-center pt-12 pb-2 bg-blue-600/90 shadow-md`, { elevation: 10 }]}>
          <ActivityIndicator size="small" color="#ffffff" style={tw`mr-2`} />
          <Text style={tw`text-white font-medium text-sm`}>{loadingText}</Text>
        </View>
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
