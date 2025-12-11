import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  createUser,
  deleteUser,
  getDepotCodes,
  getRoleColor,
  getRoleLabel,
  getUserRoleFromClaims,
  getUsers,
  updateUser
} from '../api/userApi';
import { useFetch } from '../hooks/useFetch';

// Interface pour les utilisateurs (adaptée à l'API)
interface User {
  id: string;
  username: string;
  claims: string[];
  createdAt?: string;
  lastLogin?: string;
  depotCode?: string;
}

// Composant de gestion des utilisateurs
const UsersManagementComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;

  // États
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  // États pour le formulaire (adaptés à l'API)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [selectedDepotCode, setSelectedDepotCode] = useState<string | null>(null);
  const [availableDepotCodes, setAvailableDepotCodes] = useState<string[]>([]);
  const [depotCodesLoading, setDepotCodesLoading] = useState(false);
  const [depotCodesError, setDepotCodesError] = useState<string | null>(null);

  // Récupération des utilisateurs depuis l'API
  const { data: usersData, loading: usersLoading, error: usersError, refetch: refetchUsers } = useFetch(getUsers);
  const [users, setUsers] = useState<User[]>([]);

  // Traitement des données de l'API
  useEffect(() => {
    // Le hook useFetch retourne directement result.data, pas l'objet complet de la réponse
    if (usersData && Array.isArray(usersData)) {
      // Normaliser les données selon la structure de l'API
      const normalizedUsers = (usersData as any[]).map((user: any) => ({
        id: user.id || '',
        username: user.username || '',
        claims: user.claims || [],
        depotCode: user.depotCode || '',
        createdAt: user.created ? user.created.split('T')[0] : new Date().toISOString().split('T')[0],
        lastLogin: user.updated ? user.updated.split('T')[0] : undefined
      }));
      setUsers(normalizedUsers);
    }
  }, [usersData]);

  useEffect(() => {
    const fetchDepotCodes = async () => {
      try {
        setDepotCodesLoading(true);
        setDepotCodesError(null);
        const response = await getDepotCodes();
        if (response?.success && Array.isArray(response.data)) {
          setAvailableDepotCodes(response.data.filter((code: string) => !!code));
        } else if (Array.isArray(response)) {
          setAvailableDepotCodes(response.filter((code: string) => !!code));
        } else {
          setAvailableDepotCodes([]);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des dépôts:', error);
        setDepotCodesError('Impossible de charger la liste des dépôts.');
      } finally {
        setDepotCodesLoading(false);
      }
    };

    fetchDepotCodes();
  }, []);

  useEffect(() => {
    if (!selectedDepotCode && availableDepotCodes.length > 0) {
      setSelectedDepotCode(availableDepotCodes[0]);
    }
  }, [availableDepotCodes, selectedDepotCode]);

  // Fonction pour réinitialiser le formulaire
  const resetForm = () => {
    setUsername('');
    setPassword('');
    setSelectedClaims([]);
    setSelectedUser(null);
    setSelectedDepotCode(null);
  };

  // Fonction pour ouvrir le modal d'ajout
  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Fonction pour ouvrir le modal d'édition
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setUsername(user.username);
    setPassword('');
    const role = getUserRoleFromClaims(user.claims);
    const initialClaims: string[] = [];
    if (role === 'admin') initialClaims.push('Admin');
    if (role === 'caissier') initialClaims.push('Caissier');
    setSelectedClaims(initialClaims);
    setShowEditModal(true);
  };

  // Fonction pour créer un utilisateur (adaptée à l'API)
  const handleCreateUser = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom d\'utilisateur et le mot de passe');
      return;
    }

    setLoading(true);
    try {
      const userData = {
        username: username.trim(),
        password: password.trim(),
        claims: selectedClaims.length > 0 ? selectedClaims : ['Admin'],
        depotCode: selectedDepotCode || null
      };

      await createUser(userData);
      Alert.alert('Succès', 'Utilisateur créé avec succès');
      setShowAddModal(false);
      resetForm();
      refetchUsers();
    } catch (error) {
      console.error('Erreur lors de la création de l\'utilisateur:', error);
      Alert.alert('Erreur', 'Impossible de créer l\'utilisateur');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour modifier un utilisateur (adaptée à l'API)
  const handleUpdateUser = async () => {
    if (!selectedUser || !username.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom d\'utilisateur');
      return;
    }

    setLoading(true);
    try {
      // L'API ne permet que de mettre à jour le nom d'utilisateur
      await updateUser(selectedUser.id, {
        username: username.trim()
      });

      Alert.alert('Succès', 'Nom d\'utilisateur modifié avec succès');
      setShowEditModal(false);
      resetForm();
      refetchUsers();
    } catch (error) {
      console.error('Erreur lors de la modification de l\'utilisateur:', error);
      Alert.alert('Erreur', 'Impossible de modifier l\'utilisateur');
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour supprimer un utilisateur
  const handleDeleteUser = async (user: User) => {
    Alert.alert(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.username}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(user.id);
              Alert.alert('Succès', 'Utilisateur supprimé avec succès');
              refetchUsers();
            } catch (error) {
              console.error('Erreur lors de la suppression de l\'utilisateur:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'utilisateur');
            }
          }
        }
      ]
    );
  };


  // Rendu d'une carte d'utilisateur (adapté à l'API)
  const renderUserCard = (user: User) => {
    const userRole = getUserRoleFromClaims(user.claims);
    const roleLabel = getRoleLabel(userRole);
    const roleColor = getRoleColor(userRole);

    return (
      <View key={user.id} style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.username}</Text>
            <Text style={styles.userId}>ID: {user.id}</Text>
          </View>
          <View style={styles.userBadges}>
            <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
              <Text style={styles.roleText}>{roleLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.userDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={16} color="#6B7280" />
            <Text style={styles.detailText}>Créé le {user.createdAt}</Text>
          </View>

          {user.lastLogin && (
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#6B7280" />
              <Text style={styles.detailText}>Dernière connexion: {user.lastLogin}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="business" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              Dépôt: {user.depotCode || 'Non assigné'}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="shield" size={16} color="#6B7280" />
            <Text style={styles.detailText}>
              Permissions: {user.claims.filter(claim => claim && claim !== 'string').join(', ') || 'Aucune'}
            </Text>
          </View>
        </View>

        <View style={styles.userActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEditModal(user)}
          >
            <Ionicons name="pencil" size={16} color="#3B82F6" />
            <Text style={styles.actionButtonText}>Modifier</Text>
          </TouchableOpacity>

          {/* Suppression désactivée - API non supportée */}
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton, styles.disabledButton]}
            disabled={true}
          >
            <Ionicons name="trash" size={16} color="#9CA3AF" />
            <Text style={[styles.actionButtonText, styles.disabledButtonText]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Rendu du modal d'ajout/modification
  const renderModal = (isEdit: boolean = false) => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {isEdit ? 'Modifier l\'utilisateur' : 'Ajouter un utilisateur'}
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
          {isEdit && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ID Utilisateur</Text>
              <Text style={styles.userIdDisplay}>{selectedUser?.id}</Text>
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Nom d'utilisateur *</Text>
            <TextInput
              style={styles.formInput}
              value={username}
              onChangeText={setUsername}
              placeholder="Nom d'utilisateur"
            />
          </View>

          {!isEdit && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Mot de passe *</Text>
              <TextInput
                style={styles.formInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Mot de passe"
                secureTextEntry
              />
            </View>
          )}

          {!isEdit && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Rôle</Text>
              <View style={styles.radioGroup}>
                {[
                  { value: 'Caissier', label: 'Caissier' },
                  { value: 'Admin', label: 'Administrateur' }
                ].map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={styles.radioOption}
                    onPress={() => {
                      setSelectedClaims(prev => {
                        const exists = prev.includes(option.value);
                        if (exists) {
                          return prev.filter(c => c !== option.value);
                        }
                        return [...prev, option.value];
                      });
                    }}
                  >
                    <View style={styles.radioButton}>
                      {selectedClaims.includes(option.value) && <View style={styles.radioButtonSelected} />}
                    </View>
                    <Text style={styles.radioLabel}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {!isEdit && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Dépôt associé</Text>
              {depotCodesLoading ? (
                <View style={styles.depotLoadingContainer}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.depotLoadingText}>Chargement des dépôts...</Text>
                </View>
              ) : depotCodesError ? (
                <Text style={styles.depotErrorText}>{depotCodesError}</Text>
              ) : availableDepotCodes.length === 0 ? (
                <Text style={styles.depotEmptyText}>Aucun dépôt disponible.</Text>
              ) : (
                <View style={styles.depotList}>
                  {availableDepotCodes.map((code) => {
                    const isActive = selectedDepotCode === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[
                          styles.depotBadge,
                          isActive && styles.depotBadgeActive
                        ]}
                        onPress={() => setSelectedDepotCode(code)}
                      >
                        <Ionicons
                          name={isActive ? 'checkmark-circle' : 'business'}
                          size={16}
                          color={isActive ? '#FFFFFF' : '#3B82F6'}
                          style={styles.depotBadgeIcon}
                        />
                        <Text
                          style={[
                            styles.depotBadgeText,
                            isActive && styles.depotBadgeTextActive
                          ]}
                        >
                          {code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <Text style={styles.formNote}>
                Sélectionnez le dépôt auquel l’utilisateur sera rattaché.
              </Text>
            </View>
          )}

          {isEdit && (
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Permissions actuelles</Text>
              <Text style={styles.permissionsDisplay}>
                {selectedUser?.claims.filter(claim => claim && claim !== 'string').join(', ') || 'Aucune'}
              </Text>
              <Text style={styles.formNote}>
                Note: Les permissions ne peuvent pas être modifiées via cette interface.
              </Text>
            </View>
          )}
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
            onPress={isEdit ? handleUpdateUser : handleCreateUser}
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

  if (usersLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Chargement des utilisateurs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isLargeScreen ? styles.headerWeb : styles.headerMobile]}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Gestion des utilisateurs</Text>
          <Text style={styles.headerSubtitle}>
            {users.length} utilisateur{users.length > 1 ? 's' : ''} configuré{users.length > 1 ? 's' : ''}
            {usersError && (
              <Text style={styles.errorText}> • Erreur de chargement</Text>
            )}
          </Text>
        </View>

        <View style={[styles.headerActions, isLargeScreen ? styles.headerActionsWeb : styles.headerActionsMobile]}>
          <TouchableOpacity
            style={[styles.refreshButton, isLargeScreen ? styles.refreshButtonWeb : styles.refreshButtonMobile]}
            onPress={() => refetchUsers()}
            disabled={usersLoading}
          >
            <Ionicons
              name={usersLoading ? "hourglass" : "refresh"}
              size={isLargeScreen ? 20 : 16}
              color="#FFFFFF"
            />
            <Text style={[styles.refreshButtonText, isLargeScreen ? styles.refreshButtonTextWeb : styles.refreshButtonTextMobile]}>
              {usersLoading ? 'Chargement...' : 'Actualiser'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addButton, isLargeScreen ? styles.addButtonWeb : styles.addButtonMobile]}
            onPress={openAddModal}
          >
            <Ionicons name="person-add" size={isLargeScreen ? 20 : 16} color="#FFFFFF" />
            <Text style={[styles.addButtonText, isLargeScreen ? styles.addButtonTextWeb : styles.addButtonTextMobile]}>
              {isLargeScreen ? 'Ajouter un utilisateur' : 'Ajouter'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste des utilisateurs */}
      <ScrollView style={styles.usersList} showsVerticalScrollIndicator={false}>
        {usersLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.loadingStateText}>Chargement des utilisateurs...</Text>
          </View>
        ) : usersError ? (
          <View style={styles.errorState}>
            <Ionicons name="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.errorStateTitle}>Erreur de chargement</Text>
            <Text style={styles.errorStateText}>
              {usersError}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetchUsers()}
            >
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : users.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>Aucun utilisateur configuré</Text>
            <Text style={styles.emptyStateText}>
              Commencez par ajouter votre premier utilisateur
            </Text>
          </View>
        ) : (
          <View style={styles.usersGrid}>
            {users.map(renderUserCard)}
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerActionsWeb: {
    flexDirection: 'row',
    gap: 12,
  },
  headerActionsMobile: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
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
  errorText: {
    color: '#EF4444',
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonWeb: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonMobile: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  addButtonTextWeb: {
    fontSize: 14,
    marginLeft: 6,
  },
  addButtonTextMobile: {
    fontSize: 12,
    marginLeft: 4,
  },
  refreshButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButtonWeb: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  refreshButtonMobile: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  refreshButtonTextWeb: {
    fontSize: 14,
    marginLeft: 6,
  },
  refreshButtonTextMobile: {
    fontSize: 12,
    marginLeft: 4,
  },

  // Users List
  usersList: {
    flex: 1,
    padding: 16,
  },
  usersGrid: {
    gap: 16,
  },

  // User Card
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  userId: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  userDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  userActions: {
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
  disabledButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },

  // Loading State
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },

  // Error State
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  errorStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 16,
  },
  errorStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  userIdDisplay: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  permissionsDisplay: {
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#F3F4F6',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  formNote: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  radioLabel: {
    fontSize: 14,
    color: '#374151',
  },
  depotLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  depotLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  depotErrorText: {
    fontSize: 13,
    color: '#EF4444',
  },
  depotEmptyText: {
    fontSize: 13,
    color: '#6B7280',
  },
  depotList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 4,
  },
  depotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  depotBadgeActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  depotBadgeText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  depotBadgeTextActive: {
    color: '#FFFFFF',
  },
  depotBadgeIcon: {
    marginRight: 6,
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
});

export default UsersManagementComponent;
