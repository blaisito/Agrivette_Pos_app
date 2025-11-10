// Constantes pour les claims/permissions
export const CLAIMS = {
  ADMIN: 'Admin',
  CAISSIER: 'Caissier',
  USER: 'User',
};

// Vérifier si l'utilisateur a un claim spécifique
export const hasClaim = (userClaims, claim) => {
  if (!userClaims || !Array.isArray(userClaims)) {
    return false;
  }
  return userClaims.includes(claim);
};

// Vérifier si l'utilisateur a le claim Admin
export const hasAdminClaim = (userClaims) => {
  return hasClaim(userClaims, CLAIMS.ADMIN);
};

// Vérifier si l'utilisateur a le claim Caissier
export const hasCaissierClaim = (userClaims) => {
  return hasClaim(userClaims, CLAIMS.CAISSIER);
};

// Récupérer les permissions de l'utilisateur
export const getUserPermissions = (userClaims) => {
  if (!userClaims || !Array.isArray(userClaims)) {
    return {
      isAdmin: false,
      isCaissier: false,
      isUser: false,
      canAccessAll: false,
      canAccessPOS: true, // Par défaut, tous peuvent accéder au POS
      canAccessInventory: false,
      canAccessReports: false,
      canAccessBilling: false,
    };
  }

  const isAdmin = hasAdminClaim(userClaims);
  const isCaissier = hasCaissierClaim(userClaims);
  const isUser = hasClaim(userClaims, CLAIMS.USER);

  const permissions = {
    isAdmin,
    isCaissier,
    isUser,
    canAccessAll: isAdmin, // Seuls les admins ont accès à tout
    canAccessPOS: true, // Tous peuvent accéder au POS
    canAccessInventory: isAdmin && !isCaissier, // Seuls les admins (pas caissiers) peuvent gérer l'inventaire
    canAccessReports: isAdmin || isCaissier, // Admins et caissiers peuvent voir les rapports
    canAccessBilling: isAdmin && !isCaissier, // Seuls les admins (pas caissiers) peuvent gérer la facturation
  };
  
  return permissions;
};

// Vérifier si l'utilisateur peut accéder à une fonctionnalité spécifique
export const canAccessFeature = (userClaims, feature) => {
  const permissions = getUserPermissions(userClaims);
  
  switch (feature) {
    case 'pos':
      return permissions.canAccessPOS;
    case 'inventory':
      return permissions.canAccessInventory;
    case 'reports':
      return permissions.canAccessReports;
    case 'billing':
      return permissions.canAccessBilling;
    case 'all':
      return permissions.canAccessAll;
    default:
      return false;
  }
};

// Obtenir le rôle principal de l'utilisateur
export const getUserRole = (userClaims) => {
  if (!userClaims || !Array.isArray(userClaims)) {
    return 'User';
  }

  if (hasAdminClaim(userClaims)) {
    return 'Admin';
  }
  
  if (hasCaissierClaim(userClaims)) {
    return 'Caissier';
  }
  
  return 'User';
};

// Obtenir le nom d'affichage du rôle
export const getRoleDisplayName = (userClaims) => {
  const role = getUserRole(userClaims);
  
  switch (role) {
    case 'Admin':
      return 'Administrateur';
    case 'Caissier':
      return 'Caissier';
    case 'User':
      return 'Utilisateur';
    default:
      return 'Utilisateur';
  }
};
