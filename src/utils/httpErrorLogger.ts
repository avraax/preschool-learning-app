// HTTP Error Logging Utility
// Provides comprehensive error logging for fetch requests

interface HttpRequestInfo {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string | object
}

interface HttpErrorInfo {
  // Request information
  requestUrl: string
  requestMethod: string
  requestHeaders?: Record<string, string>
  requestBody?: string | object
  
  // Response information
  responseStatus?: number
  responseStatusText?: string
  responseHeaders?: Record<string, string>
  responseBody?: string
  
  // Error information
  errorType?: string
  errorMessage?: string
  
  // Context information
  timestamp: string
  userAgent: string
  currentUrl: string
  isIOS?: boolean
}

/**
 * Logs comprehensive HTTP error information for debugging
 * @param context - Description of where the error occurred
 * @param error - The error that occurred (fetch error or custom error)
 * @param requestInfo - Information about the original request
 * @param response - The response object (if available)
 */
export async function logHttpError(
  context: string,
  error: any,
  requestInfo: HttpRequestInfo,
  response?: Response
): Promise<HttpErrorInfo> {
  const errorInfo: HttpErrorInfo = {
    // Request information
    requestUrl: requestInfo.url,
    requestMethod: requestInfo.method,
    requestHeaders: requestInfo.headers,
    requestBody: requestInfo.body,
    
    // Context information
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    currentUrl: window.location.href,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent)
  }
  
  // Add response information if available
  if (response) {
    errorInfo.responseStatus = response.status
    errorInfo.responseStatusText = response.statusText
    
    // Extract response headers
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    errorInfo.responseHeaders = responseHeaders
    
    // Try to read response body
    try {
      const responseText = await response.text()
      errorInfo.responseBody = responseText
    } catch (bodyError) {
      errorInfo.responseBody = `Failed to read response body: ${bodyError}`
    }
  }
  
  // Add error information
  if (error) {
    errorInfo.errorType = error.constructor?.name || typeof error
    errorInfo.errorMessage = error.message || error.toString()
  }
  
  // Truncate long request bodies to prevent overwhelming logs
  if (typeof errorInfo.requestBody === 'string' && errorInfo.requestBody.length > 1000) {
    errorInfo.requestBody = `${errorInfo.requestBody.substring(0, 1000)}...`
  } else if (typeof errorInfo.requestBody === 'object') {
    // For objects, create a safe copy and truncate text fields
    try {
      const safeCopy = JSON.parse(JSON.stringify(errorInfo.requestBody))
      if (safeCopy.text && typeof safeCopy.text === 'string' && safeCopy.text.length > 200) {
        safeCopy.text = `${safeCopy.text.substring(0, 200)}...`
      }
      errorInfo.requestBody = safeCopy
    } catch {
      errorInfo.requestBody = '[Unable to serialize request body]'
    }
  }
  
  // Log to console for immediate debugging
  console.error(`❌ HTTP Error [${context}]:`, errorInfo)
  
  return errorInfo
}

/**
 * Enhanced fetch wrapper that automatically logs comprehensive error information
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param context - Context description for error logging
 * @returns Promise<Response>
 */
export async function fetchWithErrorLogging(
  url: string,
  options: RequestInit = {},
  context: string = 'HTTP Request'
): Promise<Response> {
  const requestInfo: HttpRequestInfo = {
    url,
    method: options.method || 'GET',
    headers: options.headers as Record<string, string>,
    body: options.body
  }
  
  try {
    const response = await fetch(url, options)
    
    if (!response.ok) {
      await logHttpError(context, null, requestInfo, response)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return response
  } catch (error) {
    await logHttpError(context, error, requestInfo)
    throw error
  }
}

/**
 * Utility to safely extract error information from any error object
 */
export function extractErrorInfo(error: any): { type: string; message: string } {
  return {
    type: error?.constructor?.name || typeof error || 'Unknown',
    message: error?.message || error?.toString() || 'Unknown error'
  }
}