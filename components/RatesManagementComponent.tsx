import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getAppConfiguration, getExchangeRate, updateExchangeRate } from '../api/configurationApi';

// Interface pour les taux
interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  updatedAt: string;
  updatedBy: string;
}

// Interface pour l'historique des taux
interface RateHistory {
  id: string;
  rate: number;
  updatedAt: string;
  updatedBy: string;
  reason?: string;
}

// Composant de gestion des taux
const RatesManagementComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  
  // États
  const [currentRate, setCurrentRate] = useState<ExchangeRate | null>(null);
  const [appConfiguration, setAppConfiguration] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // États pour le formulaire
  const [newRate, setNewRate] = useState('');
  const [reason, setReason] = useState('');
  
  // Données simulées pour l'historique
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([
    {
      id: '1',
      rate: 2800,
      updatedAt: '2024-01-15 14:30',
      updatedBy: 'admin',
      reason: 'Mise à jour du taux de change'
    },
    {
      id: '2',
      rate: 2750,
      updatedAt: '2024-01-10 09:15',
      updatedBy: 'admin',
      reason: 'Ajustement selon le marché'
    },
    {
      id: '3',
      rate: 2850,
      updatedAt: '2024-01-05 16:45',
      updatedBy: 'admin',
      reason: 'Mise à jour quotidienne'
    }
  ]);

  // Charger le taux actuel et la configuration
  useEffect(() => {
    loadCurrentRate();
    loadAppConfiguration();
  }, []);

  const loadCurrentRate = async () => {
    setLoading(true);
    try {
      const rateData = await getExchangeRate();
      if (rateData !== undefined && rateData !== null) {
        setCurrentRate({
          id: '1',
          fromCurrency: 'USD',
          toCurrency: 'CDF',
          rate: rateData, // L'API retourne directement le nombre
          updatedAt: new Date().toLocaleString(),
          updatedBy: 'admin'
        });
      } else {
        // Valeur par défaut si pas de données
        setCurrentRate({
          id: '1',
          fromCurrency: 'USD',
          toCurrency: 'CDF',
          rate: 2800,
          updatedAt: new Date().toLocaleString(),
          updatedBy: 'admin'
        });
      }
    } catch (error) {
      console.error('Erreur lors du chargement du taux:', error);
      // Valeur par défaut en cas d'erreur
      setCurrentRate({
        id: '1',
        fromCurrency: 'USD',
        toCurrency: 'CDF',
        rate: 2800,
        updatedAt: new Date().toLocaleString(),
        updatedBy: 'admin'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour charger la configuration complète de l'application
  const loadAppConfiguration = async () => {
    try {
      const configData = await getAppConfiguration();
      if (configData) {
        setAppConfiguration(configData);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error);
      // Pas d'alerte pour cette erreur car ce n'est pas critique
    }
  };

  // Fonction pour ouvrir le modal de mise à jour
  const openUpdateModal = () => {
    setNewRate(currentRate?.rate.toString() || '');
    setReason('');
    setShowUpdateModal(true);
  };

  // Fonction pour mettre à jour le taux
  const handleUpdateRate = async () => {
    if (!newRate.trim() || isNaN(Number(newRate))) {
      Alert.alert('Erreur', 'Veuillez entrer un taux valide');
      return;
    }

    const rateValue = Number(newRate);
    if (rateValue <= 0) {
      Alert.alert('Erreur', 'Le taux doit être supérieur à 0');
      return;
    }

    setLoading(true);
    try {
      // L'API attend directement le nombre, pas un objet
      const success = await updateExchangeRate(rateValue);
      
      if (success) {
        // Mettre à jour le taux actuel
        const updatedRate: ExchangeRate = {
          id: '1',
          fromCurrency: 'USD',
          toCurrency: 'CDF',
          rate: rateValue,
          updatedAt: new Date().toLocaleString(),
          updatedBy: 'admin'
        };
        setCurrentRate(updatedRate);
        
        // Ajouter à l'historique
        const newHistoryEntry: RateHistory = {
          id: Date.now().toString(),
          rate: rateValue,
          updatedAt: new Date().toLocaleString(),
          updatedBy: 'admin',
          reason: reason.trim() || 'Mise à jour du taux de change'
        };
        setRateHistory(prev => [newHistoryEntry, ...prev]);
        
        Alert.alert('Succès', 'Taux de change mis à jour avec succès');
        setShowUpdateModal(false);
        setNewRate('');
        setReason('');
      } else {
        Alert.alert('Erreur', 'Échec de la mise à jour du taux de change');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du taux:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le taux de change');
    } finally {
      setLoading(false);
    }
  };

  // Rendu de la carte du taux actuel
  const renderCurrentRateCard = () => (
    <View style={styles.rateCard}>
      <View style={styles.rateHeader}>
        <Text style={styles.rateTitle}>Taux de change actuel</Text>
        <TouchableOpacity style={styles.updateButton} onPress={openUpdateModal}>
          <Ionicons name="pencil" size={16} color="#FFFFFF" />
          <Text style={styles.updateButtonText}>Modifier</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.rateInfo}>
        <View style={styles.rateValue}>
          <Text style={styles.rateLabel}>USD → CDF</Text>
          <Text style={styles.rateNumber}>
            {currentRate?.rate.toLocaleString()} CDF
          </Text>
        </View>
        
        <View style={styles.rateDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              Dernière mise à jour: {currentRate?.updatedAt}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Ionicons name="person" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              Mis à jour par: {currentRate?.updatedBy}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Rendu de la section des paramètres de calcul
  const renderCalculationSettings = () => (
    <View style={styles.settingsCard}>
      <Text style={styles.cardTitle}>Paramètres de calcul</Text>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Arrondi des montants</Text>
          <Text style={styles.settingDescription}>
            Les montants sont arrondis à 2 décimales pour les devises
          </Text>
        </View>
        <TouchableOpacity style={styles.settingButton}>
          <Text style={styles.settingButtonText}>Configurer</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Mise à jour automatique</Text>
          <Text style={styles.settingDescription}>
            Synchronisation avec les taux du marché (désactivé)
          </Text>
        </View>
        <TouchableOpacity style={styles.settingButton}>
          <Text style={styles.settingButtonText}>Activer</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.settingItem}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Alertes de changement</Text>
          <Text style={styles.settingDescription}>
            Notification lors de changements importants de taux
          </Text>
        </View>
        <TouchableOpacity style={styles.settingButton}>
          <Text style={styles.settingButtonText}>Configurer</Text>
        </TouchableOpacity>
      </View>

      {/* Configuration de l'application depuis l'API */}
      {appConfiguration && (
        <View style={styles.configInfo}>
          <Text style={styles.configTitle}>Configuration actuelle</Text>
          <View style={styles.configDetails}>
            <Text style={styles.configText}>
              Configuration chargée depuis l'API
            </Text>
            <Text style={styles.configSubText}>
              Dernière mise à jour: {new Date().toLocaleString()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  // Rendu du modal de mise à jour
  const renderUpdateModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Mettre à jour le taux de change</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setShowUpdateModal(false);
              setNewRate('');
              setReason('');
            }}
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalBody}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Nouveau taux (USD → CDF) *</Text>
            <TextInput
              style={styles.formInput}
              value={newRate}
              onChangeText={setNewRate}
              placeholder="Ex: 2800"
              keyboardType="numeric"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Raison du changement</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={reason}
              onChangeText={setReason}
              placeholder="Ex: Mise à jour selon le marché, ajustement quotidien..."
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowUpdateModal(false);
              setNewRate('');
              setReason('');
            }}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.disabledButton]}
            onPress={handleUpdateRate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Mettre à jour</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Rendu du modal d'historique
  const renderHistoryModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Historique des taux</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowHistoryModal(false)}
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalBody}>
          {rateHistory.map((entry) => (
            <View key={entry.id} style={styles.historyItem}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyRate}>{entry.rate.toLocaleString()} CDF</Text>
                <Text style={styles.historyDate}>{entry.updatedAt}</Text>
              </View>
              <Text style={styles.historyUser}>Par: {entry.updatedBy}</Text>
              {entry.reason && (
                <Text style={styles.historyReason}>{entry.reason}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  if (loading && !currentRate) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Chargement des taux...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gestion des taux</Text>
          <Text style={styles.headerSubtitle}>Configuration des taux de change et paramètres financiers</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.historyButton} 
          onPress={() => setShowHistoryModal(true)}
        >
          <Ionicons name="time" size={20} color="#6B7280" />
          <Text style={styles.historyButtonText}>Historique</Text>
        </TouchableOpacity>
      </View>
      
      {/* Contenu principal */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentRateCard()}
        {renderCalculationSettings()}
      </ScrollView>
      
      {/* Modals */}
      {showUpdateModal && renderUpdateModal()}
      {showHistoryModal && renderHistoryModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  historyButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  
  // Content
  content: {
    flex: 1,
    padding: 16,
  },
  
  // Rate Card
  rateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  rateInfo: {
    gap: 16,
  },
  rateValue: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  rateLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  rateNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  rateDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  
  // Settings Card
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  settingButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  settingButtonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Configuration Info
  configInfo: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  configTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  configDetails: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
  },
  configText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  configSubText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  
  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  
  // History
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  historyRate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  historyDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  historyUser: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  historyReason: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
  },
});

export default RatesManagementComponent;
