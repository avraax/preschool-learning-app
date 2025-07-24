import { useSearchParams } from 'react-router-dom'

export interface GameParams {
  level?: string
  range?: string
  limit?: number
}

export const useGameParams = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const getParam = (key: string): string | undefined => {
    return searchParams.get(key) || undefined
  }

  const setParam = (key: string, value: string | number | undefined) => {
    const newParams = new URLSearchParams(searchParams)
    if (value !== undefined && value !== null) {
      newParams.set(key, value.toString())
    } else {
      newParams.delete(key)
    }
    setSearchParams(newParams)
  }

  const getLevel = (): string | undefined => {
    return getParam('level')
  }

  const setLevel = (level: string | undefined) => {
    setParam('level', level)
  }

  const getRange = (): string | undefined => {
    return getParam('range')
  }

  const setRange = (range: string | undefined) => {
    setParam('range', range)
  }

  const getLimit = (): number => {
    const limit = getParam('limit')
    return limit ? parseInt(limit, 10) : 50
  }

  const setLimit = (limit: number) => {
    setParam('limit', limit)
  }

  const getDevice = (): string | undefined => {
    return getParam('device')
  }

  const setDevice = (device: string | undefined) => {
    setParam('device', device)
  }

  const getLogLevel = (): string | undefined => {
    return getParam('level')
  }

  const setLogLevel = (level: string | undefined) => {
    setParam('level', level)
  }

  const getAllParams = (): GameParams => {
    return {
      level: getLevel(),
      range: getRange(),
      limit: getLimit()
    }
  }

  const clearParams = () => {
    setSearchParams(new URLSearchParams())
  }

  const updateParams = (params: Partial<GameParams>) => {
    const newParams = new URLSearchParams(searchParams)
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        newParams.set(key, value.toString())
      } else {
        newParams.delete(key)
      }
    })
    
    setSearchParams(newParams)
  }

  return {
    // General param functions
    getParam,
    setParam,
    getAllParams,
    clearParams,
    updateParams,
    
    // Game-specific functions
    getLevel,
    setLevel,
    getRange,
    setRange,
    
    // Admin-specific functions
    getLimit,
    setLimit,
    getDevice,
    setDevice,
    getLogLevel,
    setLogLevel
  }
}

export const buildGameUrl = (baseUrl: string, params: Partial<GameParams>): string => {
  const url = new URL(baseUrl, window.location.origin)
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value.toString())
    }
  })
  
  return url.pathname + url.search
}