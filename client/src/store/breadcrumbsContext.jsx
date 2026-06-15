import { createContext, useContext, useState } from 'react'

const Ctx = createContext(null)

export function BreadcrumbsProvider({children}) {
  const [crumbs, setCrumbs] = useState([])
  return <Ctx.Provider value={{crumbs,setCrumbs}}>{children}</Ctx.Provider>
}

export const useBreadcrumbsCtx = () => useContext(Ctx)
