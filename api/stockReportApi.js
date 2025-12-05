import { apiClient } from './client';

// API pour les rapports de stock
export const getStockReaprovision = async (startDate, endDate, version = '1') => {
  try {
    const response = await apiClient.get(`/api/v${version}/Stock/stock-reaprovision/${startDate}/${endDate}`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des données de réapprovisionnement:', error);
    throw error;
  }
};

export const getStockSortie = async (startDate, endDate, version = '1') => {
  try {
    const response = await apiClient.get(`/api/v${version}/Stock/stock-sortie/${startDate}/${endDate}`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des données de sortie de stock:', error);
    throw error;
  }
};

// Fonction utilitaire pour formater les dates pour l'API
export const formatDateForAPI = (date) => {
  return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
};

// Rapport des mouvements de stock
export const getStockMouvementReport = async (startDate, endDate, depotCode, version = '1.0') => {
  try {
    // L'API attend un format "MM/DD/YYYY HH:MM"
    const formatDateTime = (date) => {
      const d = new Date(date);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const year = d.getFullYear();
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${month}/${day}/${year} ${hours}:${minutes}`;
    };

    const formattedStart = encodeURIComponent(formatDateTime(startDate));
    const formattedEnd = encodeURIComponent(formatDateTime(endDate));
    const depotParam = depotCode ? `&depotCode=${encodeURIComponent(depotCode)}` : '';

    const response = await apiClient.get(
      `/api/v${version}/Report/stock-mouvement-report?startDate=${formattedStart}&endDate=${formattedEnd}${depotParam}`
    );

    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération du rapport des mouvements de stock:', error);
    throw error;
  }
};