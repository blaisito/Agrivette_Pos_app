import { apiClient } from './client';

const API_VERSION = 'v1';

// Réapprovisionner le stock d'un produit
export const reapprovisionStock = async (data) => {
  try {
    const response = await apiClient.post(`/api/${API_VERSION}/Stock/reaprovision-stock`, data);
    return response;
  } catch (error) {
    console.error('Erreur lors du réapprovisionnement du stock:', error);
    throw error;
  }
};

// Retirer du stock d'un produit
export const sortieStock = async (data) => {
  try {
    const response = await apiClient.post(`/api/${API_VERSION}/Stock/sortie-stock`, data);
    return response;
  } catch (error) {
    console.error('Erreur lors de la sortie de stock:', error);
    throw error;
  }
};

// Récupérer le stock d'un produit par ID
export const getStockByProductId = async (productId) => {
  try {
    const response = await apiClient.get(`/api/${API_VERSION}/Stock/get-stock-by-product-id/${productId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération du stock:', error);
    throw error;
  }
};

// Récupérer tous les stocks
export const getAllStocks = async () => {
  try {
    const response = await apiClient.get(`/api/${API_VERSION}/Stock/get-all-stock`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des stocks:', error);
    throw error;
  }
};

// Récupérer les stocks en rupture
export const getStocksEnRupture = async () => {
  try {
    const response = await apiClient.get(`/api/${API_VERSION}/Stock/get-stock-rupture`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des stocks en rupture:', error);
    throw error;
  }
};
