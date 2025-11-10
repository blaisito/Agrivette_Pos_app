// Import conditionnel d'AsyncStorage
let AsyncStorage;

// Détection plus robuste de l'environnement
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isExpo = typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Expo');

// Fallback avec un stockage en mémoire (utilisé si AsyncStorage n'est pas disponible)
const createMemoryStorage = () => {
  const memoryStorage = {};
  return {
    getItem: (key) => Promise.resolve(memoryStorage[key] || null),
    setItem: (key, value) => Promise.resolve(memoryStorage[key] = value),
    removeItem: (key) => Promise.resolve(delete memoryStorage[key]),
    multiRemove: (keys) => Promise.resolve(keys.forEach(key => delete memoryStorage[key])),
  };
};

// Essayer d'importer AsyncStorage pour React Native/Expo
if (isReactNative || isExpo) {
  try {
    // Essayer l'import standard
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (error) {
    try {
      // Essayer l'import alternatif
      AsyncStorage = require('@react-native-async-storage/async-storage');
    } catch (error2) {
      console.warn('⚠️ AsyncStorage non disponible, utilisation du stockage en mémoire');
      AsyncStorage = createMemoryStorage();
    }
  }
} else {
  // Environnement Web - utiliser localStorage
  if (typeof localStorage !== 'undefined') {
    AsyncStorage = {
      getItem: (key) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
      removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
      multiRemove: (keys) => Promise.resolve(keys.forEach(key => localStorage.removeItem(key))),
    };
  } else {
    // Fallback avec un stockage en mémoire
    AsyncStorage = createMemoryStorage();
  }
}

// Clés de stockage
const STORAGE_KEYS = {
  USER_DATA: '@user_data',
  USER_TOKEN: '@user_token',
  IS_LOGGED_IN: '@is_logged_in',
};

// Stocker les données utilisateur
export const storeUserData = async (userData) => {
  try {
    const userDataString = JSON.stringify(userData);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, userDataString);
    
    // Stocker aussi le token séparément si disponible
    if (userData.token) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_TOKEN, userData.token);
    }
    
    // Marquer comme connecté
    await AsyncStorage.setItem(STORAGE_KEYS.IS_LOGGED_IN, 'true');
 
    return true;
  } catch (error) {
    console.error('❌ Erreur lors du stockage des données utilisateur:', error);
    return false;
  }
};

// Récupérer les données utilisateur
export const getUserData = async () => {
  try {
    const userDataString = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (userDataString) {
      const userData = JSON.parse(userDataString);

      return userData;
    }
    return null;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des données utilisateur:', error);
    return null;
  }
};

// Récupérer le token utilisateur
export const getUserToken = async () => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    return token;
  } catch (error) {
    console.error('❌ Erreur lors de la récupération du token:', error);
    return null;
  }
};

// Vérifier si l'utilisateur est connecté
export const isUserLoggedIn = async () => {
  try {
    const isLoggedIn = await AsyncStorage.getItem(STORAGE_KEYS.IS_LOGGED_IN);
    return isLoggedIn === 'true';
  } catch (error) {
    console.error('❌ Erreur lors de la vérification de la connexion:', error);
    return false;
  }
};

// Supprimer toutes les données utilisateur (déconnexion)
export const clearUserData = async () => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.USER_TOKEN,
      STORAGE_KEYS.IS_LOGGED_IN
    ]);

    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des données utilisateur:', error);
    return false;
  }
};

// Mettre à jour les données utilisateur
export const updateUserData = async (newUserData) => {
  try {
    const currentUserData = await getUserData();
    if (currentUserData) {
      const updatedUserData = { ...currentUserData, ...newUserData };
      return await storeUserData(updatedUserData);
    }
    return false;
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour des données utilisateur:', error);
    return false;
  }
};
