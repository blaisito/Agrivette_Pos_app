import { apiClient } from './client.js';

// Créer une nouvelle facture
export const createFacture = async (factureData) => {
  try {
    const response = await apiClient.post('/api/v1/Facture/create-facture', factureData);
    return response;
  } catch (error) {
    console.error('Erreur lors de la création de la facture:', error);
    throw error;
  }
};

// Mettre à jour une facture
export const updateFacture = async (factureData) => {
  try {
    const response = await apiClient.post('/api/v1/Facture/update-facture', factureData);
    return response;
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la facture:', error);
    throw error;
  }
};

// Supprimer une facture
export const deleteFacture = async (factureId) => {
  try {
    const response = await apiClient.delete(`/api/v1.0/Facture/delete-facture/${factureId}`);
    return response;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression de la facture:', error);
    throw error;
  }
};

// Récupérer une facture par ID
export const getFactureById = async (factureId) => {
  try {
    const response = await apiClient.get(`/api/v1/Facture/get-by-id/${factureId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération de la facture:', error);
    throw error;
  }
};

// Récupérer toutes les factures
export const getAllFactures = async () => {
  try {
    const response = await apiClient.get('/api/v1/Facture/get-all');
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des factures:', error);
    throw error;
  }
};

// Récupérer les factures par table
export const getFacturesByTable = async (tableId) => {
  try {
    const response = await apiClient.get(`/api/v1/Facture/get-by-table/${tableId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des factures par table:', error);
    throw error;
  }
};

// Récupérer les factures par utilisateur
export const getFacturesByUser = async (userId) => {
  try {
    const response = await apiClient.get(`/api/v1/Facture/get-by-user/${userId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des factures par utilisateur:', error);
    throw error;
  }
};

// Marquer une facture comme payée
export const markFactureAsPayed = async (factureId) => {
  try {
    const response = await apiClient.put(`/api/v1/Facture/mark-as-payed/${factureId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors du marquage de la facture comme payée:', error);
    throw error;
  }
};

// Marquer une facture comme annulée
export const markFactureAsAborted = async (factureId) => {
  try {
    const response = await apiClient.put(`/api/v1/Facture/mark-as-aborted/${factureId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors du marquage de la facture comme annulée:', error);
    throw error;
  }
};

// Récupérer les factures par plage de dates
export const getFacturesByDateRange = async (startDate, endDate, depotCode) => {
  try {
    // Formater les dates au format requis par l'API (YYYY-MM-DD)
    const formatDateForApi = (date) => {
      const d = new Date(date);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${year}-${month}-${day}`;
    };

    const formattedStartDate = formatDateForApi(startDate);
    const formattedEndDate = formatDateForApi(endDate);

    // Construire l'endpoint de base
    let endpoint = `/api/v1.0/Facture/get-by-date-range?startDate=${encodeURIComponent(formattedStartDate)}&endDate=${encodeURIComponent(formattedEndDate)}`;
    
    // Ajouter depotCode seulement s'il est fourni et non vide
    if (depotCode && depotCode.trim() !== '') {
      endpoint += `&depotCode=${encodeURIComponent(depotCode)}`;
    }

    console.log(endpoint);

    const response = await apiClient.get(endpoint);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des factures par plage de dates:', error);
    throw error;
  }
};



// Imprimer une facture
export const printFacture = async (receiptData) => {
  console.log(receiptData);
  try {
    const printUrl = 'http://localhost:8080/';

    const response = await fetch(printUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': '*/*',
      },
      body: JSON.stringify({
        command: "print",
        receipt: receiptData
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'impression de la facture:', error);
    throw error;
  }
};

// Ajouter un paiement sur une facture
export const addFacturePayment = async (paymentData) => {
  if (!paymentData?.factureId) {
    throw new Error('factureId manquant pour l\'ajout du paiement.');
  }
  const { factureId, ...rest } = paymentData;
  try {
    const endpoint = `/api/v1.0/Facture/payments/add`;
    const payload = { factureId, ...rest };
    const response = await apiClient.post(endpoint, payload);
    return response;
  } catch (error) {
    console.error('Erreur lors de l\'ajout du paiement:', error);
    throw error;
  }
};

// Récupérer l'historique des paiements d'une facture
export const getFacturePayments = async (factureId) => {
  try {
    const response = await apiClient.get(`/api/v1.0/Facture/payments/${factureId}`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des paiements:', error);
    throw error;
  }
};

// Supprimer un paiement d'une facture
export const deleteFacturePayment = async (paymentId) => {
  if (!paymentId) {
    throw new Error("paymentId manquant pour la suppression du paiement.");
  }
  try {
    const response = await apiClient.delete(
      `/api/v1.0/Facture/payments/remove/${paymentId}`,
    );
    return response;
  } catch (error) {
    console.error("Erreur lors de la suppression du paiement:", error);
    throw error;
  }
};