import { apiClient } from './client.js';

const DEFAULT_VERSION = 'v1.0';

const toDate = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  console.error('❌ Impossible de convertir en date pour les dépenses:', value);
  return null;
};

const formatDateTimeForApi = (value) => {
  const date = toDate(value);
  if (!date) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  const fractional = `${milliseconds}0000`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${fractional}`;
};

export const createDepense = async (depenseData, version = DEFAULT_VERSION) => {
  try {
    return await apiClient.post(`/api/${version}/Depense/create-depense`, depenseData);
  } catch (error) {
    console.error('❌ Erreur lors de la création de la dépense:', error);
    throw error;
  }
};

export const getDepensesByDateRange = async (startDate, endDate, version = DEFAULT_VERSION) => {
  try {
    const start = formatDateTimeForApi(startDate);
    const end = formatDateTimeForApi(endDate);

    if (!start || !end) {
      throw new Error('Les dates de début et de fin sont obligatoires pour récupérer les dépenses.');
    }

    const endpoint = `/api/${version}/Depense/get-by-date-range?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
    return await apiClient.get(endpoint);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des dépenses par plage de dates:', error);
    throw error;
  }
};

export const updateDepense = async (depenseId, depenseData, version = DEFAULT_VERSION) => {
  if (!depenseId) {
    throw new Error('Un identifiant de dépense est requis pour la mise à jour.');
  }

  try {
    const endpoint = `/api/${version}/Depense/update-depense/${depenseId}`;
    return await apiClient.post(endpoint, depenseData);
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la dépense:', error);
    throw error;
  }
};

export const deleteDepense = async (depenseId, version = DEFAULT_VERSION) => {
  if (!depenseId) {
    throw new Error('Un identifiant de dépense est requis pour la suppression.');
  }

  try {
    const endpoint = `/api/${version}/Depense/delete-depense/${depenseId}`;
    return await apiClient.delete(endpoint);
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la dépense:', error);
    throw error;
  }
};


