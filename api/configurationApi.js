import { apiClient } from './client';

// Fonction pour récupérer le taux de change
export const getExchangeRate = async () => {
  try {
    const response = await apiClient.get('/api/v1/Configuration/taux');
    if (response.success) {
      return response.data;
    } else {
      throw new Error(response.message || 'Erreur lors de la récupération du taux');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération du taux:', error);
    throw error;
  }
};

// Fonction pour mettre à jour le taux de change
export const updateExchangeRate = async (rate) => {
  try {
    const response = await apiClient.put('/api/v1/Configuration/taux', rate);
    if (response.success) {
      return response.data;
    } else {
      throw new Error(response.message || 'Erreur lors de la mise à jour du taux');
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du taux:', error);
    throw error;
  }
};

// Fonction pour récupérer la configuration complète de l'application
export const getAppConfiguration = async () => {
  try {
    const response = await apiClient.get('/api/v1/Configuration');
    if (response.success) {
      return response.data;
    } else {
      throw new Error(response.message || 'Erreur lors de la récupération de la configuration');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de la configuration:', error);
    throw error;
  }
};
