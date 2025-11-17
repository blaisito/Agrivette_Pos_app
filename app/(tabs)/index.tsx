import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getAllFactures } from '../../api/factureApi';
import { getUserPermissions } from '../../utils/permissions';
import { clearUserData, getUserData, isUserLoggedIn } from '../../utils/storage';

// Types pour les permissions utilisateur
interface UserPermissions {
  isAdmin: boolean;
  isCaissier: boolean;
  isUser: boolean;
  canAccessAll: boolean;
  canAccessPOS: boolean;
  canAccessInventory: boolean;
  canAccessReports: boolean;
  canAccessBilling: boolean;
}

// Types pour les données utilisateur
interface UserData {
  id: string;
  username: string;
  email: string;
  claims: string[];
  depotCode?: string | null;
  [key: string]: any;
}


// Import des composants
import DashboardComponent from '@/components/DashboardComponent';
import DepenseComponent from '@/components/DepenseComponent';
import FactureComponent from '@/components/FactureComponent';
import InventoryComponent from '@/components/InventoryComponent';
import KitchenComponent from '@/components/KitchenComponent';
import POSComponent from '@/components/POSComponent';
import ReportsComponent from '@/components/ReportsComponent';
import SettingsComponent from '@/components/SettingsComponent';


export default function HomeScreen() {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768; // Tablette = 768px, donc > 768px = desktop/large screen
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null);
  const [showGoodbye, setShowGoodbye] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);
  
  // États pour les badges
  const [cartItemCount, setCartItemCount] = useState(0); // Nombre d'articles dans le panier POS
  const [orderCount, setOrderCount] = useState(0); // Commandes en cuisine
  const [invoiceCount, setInvoiceCount] = useState(0); // Total des factures

  // Vérifier la connexion et charger les données utilisateur
  useEffect(() => {
    const checkUserLogin = async () => {
      try {
        const loggedIn = await isUserLoggedIn();
        
        if (!loggedIn) {
          router.replace('/');
          return;
        }

        const user = await getUserData();
        if (user) {
          setUserData(user);
          
          const permissions = getUserPermissions(user.claims || []);
          setUserPermissions(permissions);
        } else {
          router.replace('/');
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de la connexion:', error);
        router.replace('/');
      } finally {
        setIsCheckingLogin(false);
      }
    };

    checkUserLogin();
  }, []);

  // Charger les données pour les badges
  useEffect(() => {
    const loadBadgeData = async () => {
      try {
        // Charger le nombre total de factures
        const factures = await getAllFactures();
        if (factures && Array.isArray(factures)) {
          setInvoiceCount(factures.length);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des données des badges:', error);
      }
    };

    if (userData) {
      loadBadgeData();
    }
  }, [userData]);

  // Fonction pour mettre à jour le nombre d'articles dans le panier POS
  const updateCartItemCount = (count: number) => {
    setCartItemCount(count);
  };

  // Fonction de déconnexion
  const handleLogout = async () => {
    // Vérifier si on est sur web (window.confirm disponible) ou native (Alert disponible)
    const isWeb = typeof window !== 'undefined' && typeof window.confirm === 'function';
    
    if (isWeb) {
      const confirmed = window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
      if (!confirmed) return;
      showGoodbyeView();
    } else {
      Alert.alert(
        'Déconnexion',
        'Êtes-vous sûr de vouloir vous déconnecter ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Déconnexion', style: 'destructive', onPress: showGoodbyeView }
        ]
      );
    }
  };

  const showGoodbyeView = () => {
    setShowGoodbye(true);
  };

  const performLogout = async () => {
    setIsLoggingOut(true);
    try {
      await clearUserData();
      
      // Vérifier si on est sur web ou React Native
      const isWeb = typeof window !== 'undefined' && typeof window.location !== 'undefined';
      
      if (isWeb) {
        // Sur Web (desktop ou mobile), recharger la page pour retourner au login
        window.location.href = '/';
        window.location.reload();
      } else {
        // Sur React Native mobile, utiliser router.push
        router.push('/');
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      setIsLoggingOut(false);
      
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('Erreur lors de la déconnexion');
      } else {
        Alert.alert('Erreur', 'Erreur lors de la déconnexion');
      }
    }
  };

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'pos':
        return <POSComponent onCartItemCountChange={updateCartItemCount} />;
      case 'facture':
        return <FactureComponent onInvoiceCountChange={setInvoiceCount} />;
      case 'reports':
        return <ReportsComponent />;
      case 'inventory':
        return <InventoryComponent />;
      case 'depense':
        return <DepenseComponent />;
      case 'kitchen':
        return <KitchenComponent />;
      case 'settings':
        return <SettingsComponent />;
      default:
        return <DashboardComponent />;
    }
  };

  /*const tabs = [
    { key: 'dashboard', label: 'Accueil', icon: 'home' },
    { key: 'pos', label: 'POS', icon: 'restaurant' },
    { key: 'facture', label: 'Factures', icon: 'receipt' },
    { key: 'kitchen', label: 'Cuisine', icon: 'restaurant-outline' },
    { key: 'reports', label: 'Rapports', icon: 'bar-chart' },
    { key: 'inventory', label: 'Inventaire', icon: 'cube' },
    { key: 'depense', label: 'Dépenses', icon: 'card' }
  ];*/

  // Définir les onglets selon les permissions
  const getAvailableTabs = () => {
    const allTabs = [
      { key: 'dashboard', label: 'Accueil', icon: 'home', requiredPermission: null },
      { key: 'pos', label: 'POS', icon: 'calculator', requiredPermission: 'pos' },
      { key: 'facture', label: 'Factures', icon: 'receipt', requiredPermission: 'billing' },
      { key: 'depense', label: 'Dépenses', icon: 'card', requiredPermission: 'reports' },
      { key: 'reports', label: 'Rapports', icon: 'bar-chart', requiredPermission: 'reports' },
      { key: 'inventory', label: 'Inventaire', icon: 'cube', requiredPermission: 'inventory' },
      { key: 'settings', label: 'Paramètres', icon: 'settings', requiredPermission: 'admin' }
    ];

    // Si pas de permissions chargées, afficher tous les onglets
    if (!userPermissions) {
      return allTabs;
    }

    // Filtrer selon les permissions
    return allTabs.filter(tab => {
      if (!tab.requiredPermission) return true; // Accueil toujours disponible

      if (tab.requiredPermission === 'billing') {
        return true;
      }
      
      switch (tab.requiredPermission) {
        case 'pos':
          return userPermissions.canAccessPOS;
        case 'reports':
          return userPermissions.canAccessReports;
        case 'inventory':
          return userPermissions.canAccessInventory;
        case 'admin':
          return userPermissions.isAdmin;
        default:
          return true;
      }
    });
  };

  const tabs = getAvailableTabs();

  // Écran de chargement pendant la vérification de connexion
  if (isCheckingLogin) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Vérification de la connexion...</Text>
        </View>
      </View>
    );
  }

  // Vue Goodbye
  if (showGoodbye) {
    return (
      <View style={styles.goodbyeContainer}>
        <View style={styles.goodbyeContent}>
          <Ionicons name="hand-left" size={80} color="#EF4444" />
          <Text style={styles.goodbyeTitle}>Goodbye!</Text>
          <Text style={styles.goodbyeSubtitle}>
            Merci d'avoir utilisé POST-MARKET Pro
          </Text>
          <Text style={styles.goodbyeMessage}>
            Vous avez été déconnecté avec succès
          </Text>
          <TouchableOpacity 
            style={styles.loginButton} 
            onPress={performLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-in" size={20} color="#FFFFFF" />
                <Text style={styles.loginButtonText}>Retour au Login</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <View style={styles.container}>
        {/* Top Navbar */}
        <View style={styles.headerWeb}>
          <View style={styles.headerContent}>
            {/* Logo/Titre */}
            <View style={[styles.headerTitleContainerWeb, { marginTop: 6,marginBottom: 6 }]}>
              <Text style={styles.headerTitleWeb}>
                POST-MARKET Pro
              </Text>
              {userData && (
                <View style={[styles.userInfoRowWeb, { marginTop: -4 }]}>
                  <Text style={styles.userInfoTextWeb}>
                    Connecté en tant que: {userData?.username || 'Utilisateur'}
                  </Text>
                  {userData?.depotCode && (
                    <Text style={styles.userInfoTextWeb}>
                      Dépôt: {userData.depotCode}
                    </Text>
                  )}
                </View>
              )}
            </View>
            
            {/* Icônes de droite */}
            <View style={styles.actionsContainerWeb}>
              <TouchableOpacity style={styles.iconButtonWeb}>
                <Ionicons name="grid" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutButtonWeb} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Navigation secondaire */}
        <View style={styles.navContainerWeb}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.navScrollView}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.navTabWeb,
                    activeTab === tab.key && styles.navTabActive
                  ]}
                >
                  <View style={styles.tabContentWeb}>
                    <Ionicons 
                      name={tab.icon as any} 
                      size={20} 
                      color={activeTab === tab.key ? '#7C3AED' : '#6B7280'} 
                    />
                    <Text style={[
                      styles.navTabTextWeb,
                      activeTab === tab.key && styles.navTabTextActive
                    ]}>
                      {tab.label}
                    </Text>
                    {/* Badge pour POS */}
                    {tab.key === 'pos' && cartItemCount > 0 && (
                      <View style={styles.badgeWeb}>
                        <Text style={styles.badgeTextWeb}>{cartItemCount}</Text>
                      </View>
                    )}
                    {/* Badge pour Cuisine */}
                    {tab.key === 'kitchen' && orderCount > 0 && (
                      <View style={styles.badgeWeb}>
                        <Text style={styles.badgeTextWeb}>{orderCount}</Text>
                      </View>
                    )}
                    {/* Badge pour Factures */}
                    {tab.key === 'facture' && invoiceCount > 0 && (
                      <View style={styles.badgeWeb}>
                        <Text style={styles.badgeTextWeb}>{invoiceCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Contenu principal */}
        <View style={styles.mainContent}>
          {renderActiveComponent()}
        </View>
      </View>
    );
  }

  // Version Mobile/Tablet
  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.headerMobile}>
        <View style={styles.headerContentMobile}>
          {/* Logo/Titre */}
          <View style={styles.headerTitleContainerMobile}>
            <Text style={styles.headerTitleMobile}>
              POST-MARKET Pro
            </Text>
            {userData && (
              <>
                <Text style={styles.headerSubtitleMobile}>
                  {userData?.username || 'Utilisateur'}
                </Text>
                {userData?.depotCode && (
                  <Text style={styles.headerSubtitleMobile}>
                    Dépôt: {userData.depotCode}
                  </Text>
                )}
              </>
            )}
          </View>
          
          
          
          {/* Icônes de droite */}
          <View style={styles.actionsContainerMobile}>
            <TouchableOpacity style={styles.logoutButtonMobile} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarMobile}>
              <Ionicons name="calculator" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Navigation secondaire */}
      <View style={styles.navContainerMobile}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.navScrollView}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.navTabMobile,
                  activeTab === tab.key && styles.navTabActive
                ]}
              >
                <View style={styles.tabContentMobile}>
                  <Ionicons 
                    name={tab.icon as any} 
                    size={16} 
                    color={activeTab === tab.key ? '#7C3AED' : '#6B7280'} 
                  />
                  <Text style={[
                    styles.navTabTextMobile,
                    activeTab === tab.key && styles.navTabTextActive
                  ]}>
                    {tab.label}
                  </Text>
                  {/* Badge pour POS */}
                  {tab.key === 'pos' && cartItemCount > 0 && (
                    <View style={styles.badgeMobile}>
                      <Text style={styles.badgeTextMobile}>{cartItemCount}</Text>
                    </View>
                  )}
                  {/* Badge pour Cuisine */}
                  {tab.key === 'kitchen' && orderCount > 0 && (
                    <View style={styles.badgeMobile}>
                      <Text style={styles.badgeTextMobile}>{orderCount}</Text>
                    </View>
                  )}
                  {/* Badge pour Factures */}
                  {tab.key === 'facture' && invoiceCount > 0 && (
                    <View style={styles.badgeMobile}>
                      <Text style={styles.badgeTextMobile}>{invoiceCount}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Contenu principal */}
      <View style={styles.mainContent}>
        {renderActiveComponent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Container principal
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
  },

  // Header Web
  headerWeb: {
    backgroundColor: '#00436C',
    paddingHorizontal: 24,
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleContainerWeb: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerTitleWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitleWeb: {
    fontSize: 12,
    color: '#E5E7EB',
    marginTop: 2,
    marginBottom: 10,
  },
  userInfoRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  userInfoTextWeb: {
    fontSize: 16,
    color: '#F3F4F6',
    fontWeight: '400',
    marginRight: 16,
  },
  searchContainerWeb: {
    flex: 1,
    marginHorizontal: 32,
  },
  searchBarWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInputWeb: {
    marginLeft: 8,
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  actionsContainerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButtonWeb: {
    backgroundColor: '#FED7AA',
    borderRadius: 9999,
    padding: 12,
  },
  iconButtonWeb: {
    padding: 12,
  },
  logoutButtonWeb: {
    padding: 12,
    backgroundColor: '#EF4444',
    borderRadius: 8,
  },
  avatarWeb: {
    width: 40,
    height: 40,
    backgroundColor: '#D1D5DB',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  avatarImageWeb: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },

  // Header Mobile
  headerMobile: {
    backgroundColor: '#00436C',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContentMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    paddingTop: 20,
  },
  headerTitleContainerMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerTitleMobile: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitleMobile: {
    fontSize: 14,
    color: '#E5E7EB',
    marginTop: 1,
  },
  searchContainerMobile: {
    flex: 1,
    marginHorizontal: 16,
  },
  searchBarMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInputMobile: {
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  actionsContainerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonMobile: {
    backgroundColor: '#FED7AA',
    borderRadius: 9999,
    padding: 8,
  },
  iconButtonMobile: {
    padding: 8,
  },
  logoutButtonMobile: {
    padding: 8,
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  avatarMobile: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImageMobile: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },

  // Navigation Web
  navContainerWeb: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  navScrollView: {
    flexDirection: 'row',
  },
  navTabWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    marginRight: 24,
  },
  navTabTextWeb: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#4B5563',
  },

  // Navigation Mobile
  navContainerMobile: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  navTabMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    marginRight: 16,
  },
  navTabTextMobile: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },

  // Styles communs
  navTabActive: {
    backgroundColor: '#EDE9FE',
  },
  navTabTextActive: {
    color: '#7C3AED',
  },
  
  // Styles pour les conteneurs de contenu des onglets
  tabContentWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  tabContentMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  
  // Styles pour les badges
  badgeWeb: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 2,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeMobile: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 2,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeTextWeb: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeTextMobile: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Styles pour la vue Goodbye
  goodbyeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goodbyeContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 320,
  },
  goodbyeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 24,
    marginBottom: 8,
  },
  goodbyeSubtitle: {
    fontSize: 18,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  goodbyeMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00436C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Styles pour l'écran de chargement
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 280,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
});