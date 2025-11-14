import { apiClient } from './client';

// API functions for reports

/**
 * Get selling report data
 * @param {string} startDate - Start date in format MM/DD/YYYY
 * @param {string} endDate - End date in format MM/DD/YYYY
 * @returns {Promise} API response
 */
export const getSellingReport = async (startDate, endDate, depotCode) => {
  try {
    // Convertir les dates au format ISO pour l'API
    const isoStartDate = convertToISOFormat(startDate, false); // Date de début
    const isoEndDate = convertToISOFormat(endDate, true); // Date de fin
    
    const startDateEncoded = encodeURIComponent(isoStartDate);
    const endDateEncoded = encodeURIComponent(isoEndDate);
    const depotParam = depotCode ? `&depotCode=${encodeURIComponent(depotCode)}` : '';
    const endpoint = `/api/v1.0/Report/selling-report?startDate=${startDateEncoded}&endDate=${endDateEncoded}${depotParam}`;
    
    return await apiClient.get(endpoint);
  } catch (error) {
    // Retourner une réponse d'erreur au lieu de lancer une exception
    return {
      success: false,
      error: error.message || 'Erreur lors du chargement du rapport de vente',
      data: []
    };
  }
};

/**
 * Get product consumption report data
 * @param {string} startDate - Start date in format MM/DD/YYYY
 * @param {string} endDate - End date in format MM/DD/YYYY
 * @returns {Promise} API response
 */
export const getProductConsumptionReport = async (startDate, endDate) => {
  try {
    // Convertir les dates au format ISO pour l'API
    const isoStartDate = convertToISOFormat(startDate, false); // Date de début
    const isoEndDate = convertToISOFormat(endDate, true); // Date de fin
    
    const startDateEncoded = encodeURIComponent(isoStartDate);
    const endDateEncoded = encodeURIComponent(isoEndDate);
    const endpoint = `/api/v1.0/Report/product-consumption-report?startDate=${startDateEncoded}&endDate=${endDateEncoded}`;
    
    return await apiClient.get(endpoint);
  } catch (error) {
    // Retourner une réponse d'erreur au lieu de lancer une exception
    return {
      success: false,
      error: error.message || 'Erreur lors du chargement du rapport de consommation',
      data: []
    };
  }
};

/**
 * Get metrics data
 * @returns {Promise} API response
 */
export const getMetrics = async () => {
  try {
    const endpoint = '/api/v1.0/Report/metrics';
    return await apiClient.get(endpoint);
  } catch (error) {
    // Retourner une réponse d'erreur au lieu de lancer une exception
    return {
      success: false,
      error: error.message || 'Erreur lors du chargement des métriques',
      data: []
    };
  }
};

/**
 * Format date for API (ISO format YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
 * @param {Date} date - Date object
 * @param {boolean} includeTime - Whether to include time in the format
 * @returns {string} Formatted date string
 */
export const formatDateForAPI = (date, includeTime = false) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  if (includeTime) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
  
  return `${year}-${month}-${day}`;
};

/**
 * Convert MM/DD/YYYY format to ISO format for API
 * @param {string} dateString - Date in MM/DD/YYYY format
 * @param {boolean} isEndDate - Whether this is an end date (adds time to avoid same date error)
 * @returns {string} Date in YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss format
 */
export const convertToISOFormat = (dateString, isEndDate = false) => {
  if (!dateString) return '';
  
  // Si c'est déjà au format ISO avec heure, le retourner tel quel
  if (dateString.includes('T')) {
    return dateString;
  }

  // Gestion du format YYYY/MM/DD HH:mm
  const slashFormatMatch = dateString.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (slashFormatMatch) {
    const [, year, month, day, hour, minute] = slashFormatMatch;
    let hours = hour !== undefined ? hour.padStart(2, '0') : (isEndDate ? '23' : '00');
    let minutes = minute !== undefined ? minute.padStart(2, '0') : (isEndDate ? '59' : '00');
    const seconds = isEndDate ? '59' : '00';
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }
  
  // Si c'est déjà au format ISO simple, ajouter l'heure si nécessaire
  if (dateString.includes('-') && !dateString.includes('T')) {
    if (isEndDate) {
      return `${dateString}T23:59:59`;
    } else {
      return `${dateString}T00:00:00`;
    }
  }
  
  // Convertir MM/DD/YYYY vers YYYY-MM-DD
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    if (isEndDate) {
      return `${isoDate}T23:59:59`;
    } else {
      return `${isoDate}T00:00:00`;
    }
  }
  
  return dateString;
};

/**
 * Get today's date range (start and end both today)
 * @returns {Object} Object with startDate and endDate
 */
export const getTodayDateRange = () => {
  const today = new Date();
  
  // Date de début : début de journée (00:00:00)
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const startFormatted = formatDateForAPI(todayStart, true);
  
  // Date de fin : fin de journée (23:59:59) pour éviter l'erreur "Start date must be before end date"
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const endFormatted = formatDateForAPI(todayEnd, true);
  
  return {
    startDate: startFormatted,
    endDate: endFormatted
  };
};
