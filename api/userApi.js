import { apiClient } from './client';

const API_VERSION = 'v1';

export const getDepotCodes = async () => {
  try {
    const response = await apiClient.get('/api/v1.0/User/depot-codes');
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des dépôts:', error);
    throw error;
  }
};

// Récupérer tous les utilisateurs
export const getUsers = async () => {
  try {
    const response = await apiClient.get(`/api/${API_VERSION}/User/all`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    throw error;
  }
};

// Récupérer un utilisateur par ID
export const getUserById = async (userId) => {
  try {
    const response = await apiClient.get(`/api/${API_VERSION}/User/get-by-id/${userId}`);
  return response;
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    throw error;
  }
};

// Rechercher des utilisateurs par mot-clé
export const getUsersByKeyword = async (keyword) => {
  try {
    const response = await apiClient.get(`/api/${API_VERSION}/User/get-by-keyword/${keyword}`);
  return response;
  } catch (error) {
    console.error('Erreur lors de la recherche d\'utilisateurs:', error);
    throw error;
  }
};

// Créer un nouvel utilisateur
export const createUser = async (userData) => {
  try {
    const response = await apiClient.post(`/api/${API_VERSION}/User/create`, userData);
  return response;
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    throw error;
  }
};

// Mettre à jour le nom d'utilisateur
export const updateUsername = async (userId, newUsername) => {
  try {
    const response = await apiClient.put(`/api/${API_VERSION}/User/update-username/${userId}/${newUsername}`);
    return response;
  } catch (error) {
    console.error('Erreur lors de la mise à jour du nom d\'utilisateur:', error);
    throw error;
  }
};

// Mettre à jour un utilisateur (version générique pour compatibilité)
export const updateUser = async (userId, userData) => {
  try {
    // Pour cette API, on peut seulement mettre à jour le nom d'utilisateur
    if (userData.username) {
      return await updateUsername(userId, userData.username);
    }
    
    // Si pas de nom d'utilisateur, retourner une erreur
    throw new Error('Seul le nom d\'utilisateur peut être mis à jour avec cette API');
  } catch (error) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
    throw error;
  }
};

// Supprimer un utilisateur (non supporté par l'API actuelle)
export const deleteUser = async (userId) => {
  throw new Error('La suppression d\'utilisateur n\'est pas supportée par cette API');
};

// Connexion utilisateur
export const loginUser = async (username, password) => {
  try {
    const loginData = {
      username: username,
      password: password
    };
    const response = await apiClient.post(`/api/${API_VERSION}/User/loign`, loginData);
  return response;
  } catch (error) {
    console.error('❌ Erreur lors de la connexion:', error);
    throw error;
  }
};

// Fonctions utilitaires pour la gestion des utilisateurs

// Créer un utilisateur avec des données par défaut
export const createDefaultUser = async (username, password, claims = []) => {
  const userData = {
    username,
    password,
    claims
  };
  return await createUser(userData);
};

// Mettre à jour le mot de passe (non supporté par l'API actuelle)
export const updatePassword = async (userId, newPassword) => {
  throw new Error('La mise à jour du mot de passe n\'est pas supportée par cette API');
};

// Mettre à jour les permissions (claims) (non supporté par l'API actuelle)
export const updateUserClaims = async (userId, newClaims) => {
  throw new Error('La mise à jour des permissions n\'est pas supportée par cette API');
};

// Fonctions pour gérer les claims/rôles
export const getUserRoleFromClaims = (claims) => {
  if (!claims || !Array.isArray(claims)) {
    return 'user';
  }
  
  // Filtrer les claims valides (exclure "string" et autres valeurs par défaut)
  const validClaims = claims.filter(claim => 
    claim && 
    typeof claim === 'string' && 
    claim !== 'string' && 
    claim.trim() !== ''
  );
  
  if (validClaims.includes('ADMIN') || validClaims.includes('Admin')) {
    return 'admin';
  } else if (validClaims.includes('CAISSIER') || validClaims.includes('Caissier')) {
    return 'caissier';
  } else {
    return 'user';
  }
};

export const getClaimsFromRole = (role) => {
  switch (role) {
    case 'admin':
      return ['Admin', 'Caissier', 'User'];
    case 'caissier':
      return ['Caissier', 'User'];
    case 'user':
    default:
      return ['User'];
  }
};

export const getRoleLabel = (role) => {
  switch (role) {
    case 'admin':
      return 'Administrateur';
    case 'caissier':
      return 'Caissier';
    case 'user':
    default:
      return 'Utilisateur';
  }
};

export const getRoleColor = (role) => {
  switch (role) {
    case 'admin':
      return '#EF4444';
    case 'caissier':
      return '#3B82F6';
    case 'user':
    default:
      return '#10B981';
  }
};