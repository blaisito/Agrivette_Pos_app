import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createTable, deleteTable, getTables, updateTable } from '../api/tableApi';
import { useFetch } from '../hooks/useFetch';

// Interface pour les tables (adaptée à l'API)
interface Table {
  id: string;
  nomination: string;
  description?: string;
}

// Composant de gestion des tables
const TablesManagementComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  
  // États
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [loading, setLoading] = useState(false);
  
  // États pour le formulaire (adaptés à l'API)
  const [tableNomination, setTableNomination] = useState('');
  const [tableDescription, setTableDescription] = useState('');
  
  // Récupération des tables depuis l'API
  const { data: tablesData, loading: tablesLoading, error: tablesError, refetch: refetchTables } = useFetch(getTables);
  const [tables, setTables] = useState<Table[]>([]);

  // Traitement des données de l'API (adapté à la structure API)
  useEffect(() => {
    if (tablesData && Array.isArray(tablesData)) {
      // Normaliser les données selon la structure de l'API
      const normalizedTables = (tablesData as any[]).map((table: any) => ({
        id: table.id || '',
        nomination: table.nomination || '',
        description: table.description || ''
      }));
      setTables(normalizedTables);
    }
  }, [tablesData]);

  // Fonction pour réinitialiser le formulaire
  const resetForm = () => {
    setTableNomination('');
    setTableDescription('');
    setSelectedTable(null);
  };

  // Fonction pour ouvrir le modal d'ajout
  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Fonction pour ouvrir le modal d'édition
  const openEditModal = (table: Table) => {
    setSelectedTable(table);
    setTableNomination(table.nomination || '');
    setTableDescription(table.description || '');
    setShowEditModal(true);
  };

  // Fonction pour créer une table (adaptée à l'API)
  const handleCreateTable = async () => {
    if (!tableNomination.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom de poste');
      return;
    }

    setLoading(true);
    try {
      const tableData = {
        nomination: tableNomination.trim(),
        description: tableDescription.trim() || undefined
      };

      await createTable(tableData);
      Alert.alert('Succès', 'Table créée avec succès');
      setShowAddModal(false);
      resetForm();
      refetchTables();
    } catch (error) {
      console.error('Erreur lors de la création de la table:', error);
      Alert.alert('Erreur', 'Impossible de créer la table');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour modifier une table (adaptée à l'API)
  const handleUpdateTable = async () => {
    if (!selectedTable || !tableNomination.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom de poste');
      return;
    }

    setLoading(true);
    try {
      const tableData = {
        nomination: tableNomination.trim(),
        description: tableDescription.trim() || undefined
      };

      await updateTable(selectedTable.id, tableData);
      Alert.alert('Succès', 'Table modifiée avec succès');
      setShowEditModal(false);
      resetForm();
      refetchTables();
    } catch (error) {
      console.error('Erreur lors de la modification de la table:', error);
      Alert.alert('Erreur', 'Impossible de modifier la table');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour supprimer une table
  const handleDeleteTable = async (table: Table) => {
    Alert.alert(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer la table "${table.nomination}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTable(table.id);
              Alert.alert('Succès', 'Table supprimée avec succès');
              refetchTables();
            } catch (error) {
              console.error('Erreur lors de la suppression de la table:', error);
              Alert.alert('Erreur', 'Impossible de supprimer la table');
            }
          }
        }
      ]
    );
  };


  // Rendu d'une carte de table (adapté à l'API)
  const renderTableCard = (table: Table) => (
    <View key={table.id} style={styles.tableCard}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableName}>{table.nomination || 'Table sans nom'}</Text>
      </View>
      
      <View style={styles.tableInfo}>
        {table.description && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text" size={16} color="#6B7280" />
            <Text style={styles.infoText} numberOfLines={3}>{table.description}</Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <Ionicons name="key" size={16} color="#6B7280" />
          <Text style={styles.infoText}>ID: {table.id}</Text>
        </View>
      </View>
      
      <View style={styles.tableActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(table)}
        >
          <Ionicons name="pencil" size={16} color="#3B82F6" />
          <Text style={styles.actionButtonText}>Modifier</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteTable(table)}
        >
          <Ionicons name="trash" size={16} color="#EF4444" />
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Rendu du modal d'ajout/modification
  const renderModal = (isEdit: boolean = false) => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {isEdit ? 'Modifier le poste' : 'Ajouter un poste'}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              resetForm();
            }}
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalBody}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Nom de poste *</Text>
            <TextInput
              style={styles.formInput}
              value={tableNomination}
              onChangeText={setTableNomination}
              placeholder="Ex: Table 1, VIP A, Terrasse 3"
            />
          </View>
          
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.formInput, styles.textArea]}
              value={tableDescription}
              onChangeText={setTableDescription}
              placeholder="Description optionnelle"
              multiline
              numberOfLines={3}
            />
          </View>
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              resetForm();
            }}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.disabledButton]}
            onPress={isEdit ? handleUpdateTable : handleCreateTable}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {isEdit ? 'Modifier' : 'Créer'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (tablesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Chargement des tables...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gestion des postes</Text>
          <Text style={styles.headerSubtitle}>
            {tables.length} table{tables.length > 1 ? 's' : ''} configurée{tables.length > 1 ? 's' : ''}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Ajouter un poste</Text>
        </TouchableOpacity>
      </View>
      
      {/* Liste des tables */}
      <ScrollView style={styles.tablesList} showsVerticalScrollIndicator={false}>
        {tables.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calculator" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>Aucun poste configuré</Text>
            <Text style={styles.emptyStateText}>
              Commencez par ajouter votre première poste
            </Text>
          </View>
        ) : (
          <View style={styles.tablesGrid}>
            {tables.map(renderTableCard)}
          </View>
        )}
      </ScrollView>
      
      {/* Modals */}
      {showAddModal && renderModal(false)}
      {showEditModal && renderModal(true)}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  
  // Tables List
  tablesList: {
    flex: 1,
    padding: 16,
  },
  tablesGrid: {
    gap: 16,
  },
  
  // Table Card
  tableCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  tableInfo: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  tableActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
    color: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
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
});

export default TablesManagementComponent;
