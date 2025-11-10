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
