import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getMetrics } from '../api/reportApi';
import { getUserData } from '../utils/storage';

// Types pour les métriques
interface MetricsData {
  totalUsers: number;
  totalCategories: number;
  totalProducts: number;
  totalTables: number;
  totalFactures: number;
  totalVentes: number;
  totalStockMouvements: number;
  activeFactures: number;
  paidFactures: number;
  abortedFactures: number;
  generatedAt: string;
}

// Composant Dashboard
const DashboardComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768; // Tablette = 768px, donc > 768px = desktop/large screen
  
  // États pour les métriques
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState('');

  // Charger les métriques au montage du composant
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getMetrics();
        if (response?.success && response?.data) {
          setMetrics(response.data);
        } else {
          setError('Erreur lors du chargement des métriques');
        }
      } catch (err) {
        setError('Erreur lors du chargement des métriques');
        console.error('Error loading metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMetrics();
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getUserData();
        if (user) {
          const displayName =
            user.fullName ||
            user.username ||
            user.name ||
            user.email ||
            'Utilisateur';
          setUserDisplayName(displayName);
        } else {
          setUserDisplayName('Utilisateur');
        }
      } catch (err) {
        console.warn('Impossible de charger l’utilisateur pour le dashboard.', err);
        setUserDisplayName('Utilisateur');
      }
    };

    loadUser();
  }, []);
  
  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <ScrollView style={[styles.containerWeb, {paddingHorizontal: 140}]}>
        <Text style={styles.titleWeb}>Tableau de bord</Text>
        
        {/* Banner avec image de restaurant de luxe */}
        <View style={styles.bannerWeb}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' }}
            style={styles.bannerImageWeb}
            resizeMode="cover"
          />
          <View style={styles.bannerOverlayWeb}>
            <View style={styles.bannerContentWeb}>
              <Text style={styles.bannerTitleWeb}>Restaurant Manager Pro</Text>
              <Text style={styles.bannerSubtitleWeb}>
                Optimisez votre restaurant avec notre solution complète de gestion
              </Text>
              <View style={styles.bannerFeaturesWeb}>
                <View style={styles.bannerFeatureWeb}>
                  <Text style={styles.bannerFeatureTextWeb}>📊 Tableau de bord en temps réel</Text>
                </View>
                <View style={styles.bannerFeatureWeb}>
                  <Text style={styles.bannerFeatureTextWeb}>🍽️ Gestion des commandes simplifiée</Text>
                </View>
                <View style={styles.bannerFeatureWeb}>
                  <Text style={styles.bannerFeatureTextWeb}>📈 Rapports détaillés et analytics</Text>
                </View>
                <View style={styles.bannerFeatureWeb}>
                  <Text style={styles.bannerFeatureTextWeb}>📱 Interface mobile et web responsive</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
        
        {/* Carte de bienvenue */}
        <View style={styles.welcomeCardWebWrapper}>
          <LinearGradient
            colors={['#7C3AED', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.welcomeCardWeb}
          >
            <Text style={styles.welcomeTitle}>Bienvenue, {userDisplayName || 'Utilisateur'} !</Text>
            <Text style={styles.welcomeSubtitle}>
              Voici un aperçu de votre restaurant aujourd'hui.
            </Text>
          </LinearGradient>
        </View>
        
        {/* Statistiques */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <Ionicons name="hourglass-outline" size={48} color="#3B82F6" />
            <Text style={styles.loadingText}>Chargement des métriques...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.salesCard]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="trending-up" size={24} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{metrics?.totalVentes || 0}</Text>
              <Text style={styles.statLabel}>Ventes totales</Text>
              <View style={styles.statTrend}>
                <Ionicons name="arrow-up" size={12} color="#10B981" />
                <Text style={styles.trendText}>Total</Text>
              </View>
            </View>
            <View style={[styles.statCard, styles.ordersCard]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="receipt" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.statValue}>{metrics?.totalFactures || 0}</Text>
              <Text style={styles.statLabel}>Factures</Text>
              <View style={styles.statTrend}>
                <Ionicons name="arrow-up" size={12} color="#10B981" />
                <Text style={styles.trendText}>Total</Text>
              </View>
            </View>
            <View style={[styles.statCard, styles.occupiedCard]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="restaurant" size={24} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{metrics?.totalTables || 0}</Text>
              <Text style={styles.statLabel}>Tables</Text>
              <View style={styles.statTrend}>
                <Ionicons name="arrow-up" size={12} color="#10B981" />
                <Text style={styles.trendText}>Total</Text>
              </View>
            </View>
            <View style={[styles.statCard, styles.availableCard]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="cube" size={24} color="#8B5CF6" />
              </View>
              <Text style={styles.statValue}>{metrics?.totalProducts || 0}</Text>
              <Text style={styles.statLabel}>Produits</Text>
              <View style={styles.statTrend}>
                <Ionicons name="arrow-up" size={12} color="#10B981" />
                <Text style={styles.trendText}>Total</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  }

  // Version Mobile/Tablet
  return (
    <ScrollView style={styles.containerMobile}>
      <Text style={styles.titleMobile}>Tableau de bord</Text>
      
      {/* Banner avec image de restaurant de luxe */}
      <View style={styles.bannerMobile}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80' }}
          style={styles.bannerImageMobile}
          resizeMode="cover"
        />
        <View style={styles.bannerOverlayMobile}>
          <View style={styles.bannerContentMobile}>
            <Text style={styles.bannerTitleMobile}>Restaurant Manager Pro</Text>
            <Text style={styles.bannerSubtitleMobile}>
              Optimisez votre restaurant avec notre solution complète de gestion
            </Text>
            
          </View>
        </View>
      </View>
      
      {/* Carte de bienvenue */}
      <View style={styles.welcomeCardMobileWrapper}>
        <LinearGradient
          colors={['#7C3AED', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeCardMobile}
        >
          <Text style={styles.welcomeTitle}>Bienvenue, {userDisplayName || 'Utilisateur'} !</Text>
          <Text style={styles.welcomeSubtitle}>
            Voici un aperçu de votre restaurant aujourd'hui.
          </Text>
        </LinearGradient>
      </View>
      
      {/* Statistiques */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="hourglass-outline" size={32} color="#3B82F6" />
          <Text style={styles.loadingText}>Chargement des métriques...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.salesCard]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="trending-up" size={24} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{metrics?.totalVentes || 0}</Text>
            <Text style={styles.statLabel}>Ventes totales</Text>
            <View style={styles.statTrend}>
              <Ionicons name="arrow-up" size={12} color="#10B981" />
              <Text style={styles.trendText}>Total</Text>
            </View>
          </View>
          <View style={[styles.statCard, styles.ordersCard]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="receipt" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.statValue}>{metrics?.totalFactures || 0}</Text>
            <Text style={styles.statLabel}>Factures</Text>
            <View style={styles.statTrend}>
              <Ionicons name="arrow-up" size={12} color="#10B981" />
              <Text style={styles.trendText}>Total</Text>
            </View>
          </View>
          <View style={[styles.statCard, styles.occupiedCard]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="restaurant" size={24} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{metrics?.totalTables || 0}</Text>
            <Text style={styles.statLabel}>Tables</Text>
            <View style={styles.statTrend}>
              <Ionicons name="arrow-up" size={12} color="#10B981" />
              <Text style={styles.trendText}>Total</Text>
            </View>
          </View>
          <View style={[styles.statCard, styles.availableCard]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="cube" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>{metrics?.totalProducts || 0}</Text>
            <Text style={styles.statLabel}>Produits</Text>
            <View style={styles.statTrend}>
              <Ionicons name="arrow-up" size={12} color="#10B981" />
              <Text style={styles.trendText}>Total</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  // Container Web
  containerWeb: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  titleWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },

  // Container Mobile
  containerMobile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  titleMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },

  // Carte de bienvenue Web
  welcomeCardWebWrapper: {
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
  welcomeCardWeb: {
    borderRadius: 5,
    paddingVertical: 32,
    paddingHorizontal: 36,
  },

  // Carte de bienvenue Mobile
  welcomeCardMobileWrapper: {
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  welcomeCardMobile: {
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 24,
  },

  // Titre et sous-titre
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#E0E7FF',
    lineHeight: 24,
  },

  // Grille des statistiques
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Carte de statistique
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    padding: 20,
    width: '48%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  
  // Styles spécifiques pour chaque carte
  salesCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  ordersCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  occupiedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  availableCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  
  // Container pour l'icône
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  
  // Indicateur de tendance
  statTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  trendText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Styles pour les tendances négatives
  trendNegative: {
    backgroundColor: '#FEF2F2',
  },
  trendTextNegative: {
    color: '#EF4444',
  },

  // Styles pour le banner Web
  bannerWeb: {
    height: 300,
    borderRadius: 5,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImageWeb: {
    width: '100%',
    height: '100%',
  },
  bannerOverlayWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerContentWeb: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  bannerTitleWeb: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  bannerSubtitleWeb: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.9,
  },
  bannerFeaturesWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  bannerFeatureWeb: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backdropFilter: 'blur(10px)',
  },
  bannerFeatureTextWeb: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },

  // Styles pour le banner Mobile
  bannerMobile: {
    height: 250,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImageMobile: {
    width: '100%',
    height: '100%',
  },
  bannerOverlayMobile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerContentMobile: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bannerTitleMobile: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  bannerSubtitleMobile: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 20,
  },
  bannerFeaturesMobile: {
    flexDirection: 'column',
    gap: 8,
  },
  bannerFeatureMobile: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backdropFilter: 'blur(10px)',
  },
  bannerFeatureTextMobile: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Loading and Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    margin: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
});

export default DashboardComponent;
