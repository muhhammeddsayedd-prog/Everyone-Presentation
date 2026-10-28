'use client';
import { createContext, useContext } from 'react';
export const RuntimeMode = createContext<'local_fixture' | 'supabase'>('local_fixture');
export const useRuntimeMode = () => useContext(RuntimeMode);
