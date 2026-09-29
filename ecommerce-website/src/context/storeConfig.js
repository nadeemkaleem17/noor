import { createContext } from 'react'

// Kept separate from StoreConfigContext.jsx so that file only exports components (fast refresh).
export const StoreConfigContext = createContext(null)
