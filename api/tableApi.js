import { apiClient } from './client';

const API_VERSION = 'v1';

// Récupérer toutes les tables
export const getTables = async () => {
  try {
    const response = await apiClient.get(`/api/${API_VERSION}/Table/get-all`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des tables:', error);
    throw error;
  }
};

// Récupérer une table par ID
export const getTableById = async (tableId) => {
  try {
    const response = await apiClient.get(`/api/${API_VERSION}/Table/get-by-id/${tableId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération de la table:', error);
    throw error;
  }
};

// Créer une nouvelle table
export const createTable = async (tableData) => {
  try {
    const response = await apiClient.post(`/api/${API_VERSION}/Table/create-table`, tableData);
    return response;
  } catch (error) {
    console.error('Erreur lors de la création de la table:', error);
    throw error;
  }
};

// Mettre à jour une table
export const updateTable = async (tableId, tableData) => {
  try {
    const response = await apiClient.post(`/api/${API_VERSION}/Table/update-table/${tableId}`, tableData);
    return response;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la table:', error);
    throw error;
  }
};

// Supprimer une table
export const deleteTable = async (tableId) => {
  try {
    const response = await apiClient.delete(`/api/${API_VERSION}/Table/delete-table/${tableId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la suppression de la table:', error);
    throw error;
  }
};

// Fonctions utilitaires pour la gestion des tables

// Créer une table avec des données par défaut
export const createDefaultTable = async (nomination, description = '') => {
  const tableData = {
    nomination,
    description
  };
  return await createTable(tableData);
};

// Mettre à jour le nom d'une table
export const updateTableName = async (tableId, newName) => {
  const tableData = {
    nomination: newName
  };
  return await updateTable(tableId, tableData);
};

// Mettre à jour la description d'une table
export const updateTableDescription = async (tableId, newDescription) => {
  const tableData = {
    description: newDescription
  };
  return await updateTable(tableId, newDescription);
};
