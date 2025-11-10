import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Types pour les commandes
interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
}

interface Order {
  id: string;
  tableNumber: string;
  customerName: string;
  items: OrderItem[];
  status: 'pending' | 'in_progress' | 'ready' | 'served' | 'completed';
  orderTime: string;
  estimatedTime?: string;
  total: number;
}

// Données de test
const mockOrders: Order[] = [
  {
    id: '001',
    tableNumber: 'T-12',
    customerName: 'Jean Dupont',
    items: [
      { id: '1', name: 'Pizza Margherita', quantity: 1, notes: 'Sans gluten' },
      { id: '2', name: 'Salade César', quantity: 1 },
      { id: '3', name: 'Coca-Cola', quantity: 2 }
    ],
    status: 'in_progress',
    orderTime: '14:30',
    estimatedTime: '15:00',
    total: 28.50
  },
  {
    id: '002',
    tableNumber: 'T-08',
    customerName: 'Marie Martin',
    items: [
      { id: '4', name: 'Pâtes Carbonara', quantity: 1 },
      { id: '5', name: 'Tiramisu', quantity: 1 }
    ],
    status: 'ready',
    orderTime: '14:15',
    total: 22.00
  },
  {
    id: '003',
    tableNumber: 'T-15',
    customerName: 'Pierre Durand',
    items: [
      { id: '6', name: 'Burger Deluxe', quantity: 1, notes: 'Bien cuit' },
      { id: '7', name: 'Frites', quantity: 1 }
    ],
    status: 'pending',
    orderTime: '14:45',
    estimatedTime: '15:15',
    total: 18.50
  },
  {
    id: '004',
    tableNumber: 'T-03',
    customerName: 'Sophie Bernard',
    items: [
      { id: '8', name: 'Salade Niçoise', quantity: 1 },
      { id: '9', name: 'Eau minérale', quantity: 1 }
    ],
    status: 'completed',
    orderTime: '14:00',
    total: 15.00
  }
];

const KitchenComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768; // Tablette = 768px, donc > 768px = desktop/large screen
  
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderModalVisible, setIsOrderModalVisible] = useState(false);
  const [editedOrder, setEditedOrder] = useState<Order | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filters = [
    { key: 'all', label: 'Toutes', icon: 'list' },
    { key: 'pending', label: 'En attente', icon: 'time' },
    { key: 'in_progress', label: 'En cours', icon: 'restaurant' },
    { key: 'ready', label: 'Prêtes', icon: 'checkmark-circle' },
    { key: 'completed', label: 'Terminées', icon: 'checkmark-done' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#EF4444'; // Rouge vif pour en attente
      case 'in_progress': return '#F97316'; // Orange pour en cours
      case 'ready': return '#22C55E'; // Vert pour prêt
      case 'completed': return '#6B7280'; // Gris pour terminé
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'in_progress': return 'En cours';
      case 'ready': return 'Prête';
      case 'completed': return 'Terminée';
      default: return 'Inconnu';
    }
  };

  const filteredOrders = selectedFilter === 'all' 
    ? mockOrders 
    : mockOrders.filter(order => order.status === selectedFilter);

  // Fonctions pour gérer la modal de commande
  const openOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setEditedOrder({ ...order });
    setIsOrderModalVisible(true);
  };

  const closeOrderModal = () => {
    setIsOrderModalVisible(false);
    setSelectedOrder(null);
    setEditedOrder(null);
  };

  const updateOrderStatus = (newStatus: string) => {
    if (editedOrder) {
      setEditedOrder({ ...editedOrder, status: newStatus as any });
    }
  };

  const updateOrderInfo = (field: string, value: string) => {
    if (editedOrder) {
      setEditedOrder({ ...editedOrder, [field]: value });
    }
  };

  const saveOrderChanges = () => {
    if (editedOrder && selectedOrder) {
      // Ici vous pouvez ajouter la logique pour sauvegarder les changements
      // Par exemple, mettre à jour la base de données ou l'état global
      closeOrderModal();
    }
  };

  const refreshOrders = async () => {
    setIsRefreshing(true);
    try {
      // Simuler un appel API pour rafraîchir les commandes
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Ici vous pouvez ajouter la logique pour récupérer les nouvelles commandes
      // Par exemple, refetch des données depuis l'API
    } catch (error) {
      console.error('Erreur lors du rafraîchissement:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const OrderCard = ({ order }: { order: Order }) => (
    <TouchableOpacity 
      style={isLargeScreen ? styles.orderCardWeb : styles.orderCardMobile}
      onPress={() => openOrderModal(order)}
      activeOpacity={0.7}
    >
      {/* En-tête coloré */}
      <View style={[styles.orderHeaderColored, { backgroundColor: getStatusColor(order.status) }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.customerNameHeader}>{order.customerName}</Text>
          <Text style={styles.orderTimeHeader}>{order.orderTime}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.tableNumberHeader}>{order.tableNumber}</Text>
        </View>
      </View>

      {/* Corps de la carte */}
      <View style={styles.orderBody}>
        {/* Liste des articles */}
        <View style={styles.itemsContainer}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={isLargeScreen ? styles.itemNameWeb : styles.itemNameMobile}>
                  {item.quantity}x {item.name}
                </Text>
                {item.notes && (
                  <Text style={isLargeScreen ? styles.itemNotesWeb : styles.itemNotesMobile}>
                    Note: {item.notes}
                  </Text>
                )}
              </View>
              <View style={styles.checkIcon}>
                <Ionicons name="checkmark-circle" size={20} color="#D1D5DB" />
              </View>
            </View>
          ))}
        </View>

        {/* Footer de la carte */}
        <View style={styles.orderFooter}>
          <View style={styles.timeInfo}>
            {order.estimatedTime && (
              <>
                <Ionicons name="time" size={16} color="#6B7280" />
                <Text style={isLargeScreen ? styles.estimatedTimeWeb : styles.estimatedTimeMobile}>
                  Prêt: {order.estimatedTime}
                </Text>
              </>
            )}
          </View>
          <Text style={isLargeScreen ? styles.totalWeb : styles.totalMobile}>
            €{order.total.toFixed(2)}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actionButtons}>
          {order.status === 'pending' && (
            <TouchableOpacity style={[styles.actionButton, styles.startButton]}>
              <Ionicons name="play" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Commencer</Text>
            </TouchableOpacity>
          )}
          {order.status === 'in_progress' && (
            <TouchableOpacity style={[styles.actionButton, styles.readyButton]}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Prêt</Text>
            </TouchableOpacity>
          )}
          {order.status === 'ready' && (
            <TouchableOpacity style={[styles.actionButton, styles.serveButton]}>
              <Ionicons name="restaurant" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Servir</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <ScrollView style={[styles.containerWeb, { paddingHorizontal: 0 }]}>
        <View style={styles.headerWeb}>
          <Text style={[styles.titleWeb,{paddingLeft: 140}]}>Cuisine</Text>
          <TouchableOpacity 
            style={[styles.refreshButton,{marginRight: 140}]}
            onPress={refreshOrders}
            disabled={isRefreshing}
          >
            <Ionicons 
              name={isRefreshing ? "refresh" : "refresh-outline"} 
              size={20} 
              color="#7C3AED"
              style={isRefreshing ? styles.refreshIconSpinning : styles.refreshIcon}
            />
            <Text style={styles.refreshButtonText}>
              {isRefreshing ? 'Actualisation...' : 'Actualiser'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Filtres */}
        <View style={[styles.filtersContainerWeb,{paddingHorizontal: 140}]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filtersScrollView}>
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setSelectedFilter(filter.key)}
                  style={[
                    styles.filterButtonWeb,
                    selectedFilter === filter.key && styles.filterButtonActiveWeb
                  ]}
                >
                  <Ionicons 
                    name={filter.icon as any} 
                    size={20} 
                    color={selectedFilter === filter.key ? '#7C3AED' : '#6B7280'} 
                  />
                  <Text style={[
                    styles.filterTextWeb,
                    selectedFilter === filter.key && styles.filterTextActiveWeb
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Liste des commandes */}
        <View style={[styles.ordersGridWeb,{paddingHorizontal: 140}]}>
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </View>

        {/* Modal de détails de commande */}
    {isOrderModalVisible && editedOrder && (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={closeOrderModal}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header de la modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails de la commande</Text>
              <TouchableOpacity onPress={closeOrderModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {/* Informations de base */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Informations générales</Text>
                
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Nom du client</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedOrder?.customerName || ''}
                    onChangeText={(value) => updateOrderInfo('customerName', value)}
                    placeholder="Nom du client"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Numéro de table</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedOrder?.tableNumber || ''}
                    onChangeText={(value) => updateOrderInfo('tableNumber', value)}
                    placeholder="Numéro de table"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Heure de commande</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedOrder?.orderTime || ''}
                    onChangeText={(value) => updateOrderInfo('orderTime', value)}
                    placeholder="HH:MM"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Temps estimé</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedOrder?.estimatedTime || ''}
                    onChangeText={(value) => updateOrderInfo('estimatedTime', value)}
                    placeholder="HH:MM"
                  />
                </View>
              </View>

              {/* Statut de la commande */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Statut de la commande</Text>
                <View style={styles.statusButtonsContainer}>
                  {[
                    { key: 'pending', label: 'En attente', color: '#EF4444' },
                    { key: 'in_progress', label: 'En cours', color: '#F97316' },
                    { key: 'ready', label: 'Prête', color: '#22C55E' },
                    { key: 'completed', label: 'Terminée', color: '#6B7280' }
                  ].map((status) => (
                    <TouchableOpacity
                      key={status.key}
                      style={[
                        styles.statusButton,
                        { backgroundColor: status.color },
                        editedOrder?.status === status.key && styles.statusButtonActive
                      ]}
                      onPress={() => updateOrderStatus(status.key)}
                    >
                      <Text style={styles.statusButtonText}>{status.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Articles de la commande */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Articles commandés</Text>
                {editedOrder?.items.map((item) => (
                  <View key={item.id} style={styles.modalItemRow}>
                    <View style={styles.modalItemInfo}>
                      <Text style={styles.modalItemName}>{item.name}</Text>
                      {item.notes && (
                        <Text style={styles.modalItemNotes}>Note: {item.notes}</Text>
                      )}
                    </View>
                    <View style={styles.modalItemQuantity}>
                      <Text style={styles.modalItemQuantityText}>{item.quantity}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Total */}
              <View style={styles.modalSection}>
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Total:</Text>
                  <Text style={styles.modalTotalValue}>€{editedOrder?.total.toFixed(2)}</Text>
                </View>
              </View>
            </ScrollView>

            {/* Boutons d'action */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeOrderModal}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveOrderChanges}
                style={styles.saveButton}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Sauvegarder</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    )}
      </ScrollView>
    );
  }

  // Version Mobile/Tablet
  return (
    <View style={styles.containerMobile}>
      <ScrollView style={styles.scrollViewMobile}>
        <View style={styles.headerMobile}>
          <Text style={styles.titleMobile}>Cuisine</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={refreshOrders}
            disabled={isRefreshing}
          >
            <Ionicons 
              name={isRefreshing ? "refresh" : "refresh-outline"} 
              size={16} 
              color="#7C3AED"
              style={isRefreshing ? styles.refreshIconSpinning : styles.refreshIcon}
            />
            <Text style={styles.refreshButtonText}>
              {isRefreshing ? 'Actualisation...' : 'Actualiser'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Filtres */}
        <View style={styles.filtersContainerMobile}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filtersScrollView}>
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter.key}
                  onPress={() => setSelectedFilter(filter.key)}
                  style={[
                    styles.filterButtonMobile,
                    selectedFilter === filter.key && styles.filterButtonActiveMobile
                  ]}
                >
                  <Ionicons 
                    name={filter.icon as any} 
                    size={16} 
                    color={selectedFilter === filter.key ? '#7C3AED' : '#6B7280'} 
                  />
                  <Text style={[
                    styles.filterTextMobile,
                    selectedFilter === filter.key && styles.filterTextActiveMobile
                  ]}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Liste des commandes */}
        <View style={styles.ordersContainerMobile}>
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </View>
      </ScrollView>

      {/* Modal de détails de commande */}
    {isOrderModalVisible && editedOrder && (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={closeOrderModal}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header de la modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails de la commande</Text>
              <TouchableOpacity onPress={closeOrderModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView}>
              {/* Informations de base */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Informations générales</Text>
                
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Nom du client</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedOrder?.customerName || ''}
                    onChangeText={(value) => updateOrderInfo('customerName', value)}
                    placeholder="Nom du client"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Numéro de table</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedOrder?.tableNumber || ''}
                    onChangeText={(value) => updateOrderInfo('tableNumber', value)}
                    placeholder="Numéro de table"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Heure de commande</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedOrder?.orderTime || ''}
                    onChangeText={(value) => updateOrderInfo('orderTime', value)}
                    placeholder="HH:MM"
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLabel}>Temps estimé</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedOrder?.estimatedTime || ''}
                    onChangeText={(value) => updateOrderInfo('estimatedTime', value)}
                    placeholder="HH:MM"
                  />
                </View>
              </View>

              {/* Statut de la commande */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Statut de la commande</Text>
                <View style={styles.statusButtonsContainer}>
                  {[
                    { key: 'pending', label: 'En attente', color: '#EF4444' },
                    { key: 'in_progress', label: 'En cours', color: '#F97316' },
                    { key: 'ready', label: 'Prête', color: '#22C55E' },
                    { key: 'completed', label: 'Terminée', color: '#6B7280' }
                  ].map((status) => (
                    <TouchableOpacity
                      key={status.key}
                      style={[
                        styles.statusButton,
                        { backgroundColor: status.color },
                        editedOrder?.status === status.key && styles.statusButtonActive
                      ]}
                      onPress={() => updateOrderStatus(status.key)}
                    >
                      <Text style={styles.statusButtonText}>{status.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Articles de la commande */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Articles commandés</Text>
                {editedOrder?.items.map((item) => (
                  <View key={item.id} style={styles.modalItemRow}>
                    <View style={styles.modalItemInfo}>
                      <Text style={styles.modalItemName}>{item.name}</Text>
                      {item.notes && (
                        <Text style={styles.modalItemNotes}>Note: {item.notes}</Text>
                      )}
                    </View>
                    <View style={styles.modalItemQuantity}>
                      <Text style={styles.modalItemQuantityText}>{item.quantity}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Total */}
              <View style={styles.modalSection}>
                <View style={styles.modalTotalRow}>
                  <Text style={styles.modalTotalLabel}>Total:</Text>
                  <Text style={styles.modalTotalValue}>€{editedOrder?.total.toFixed(2)}</Text>
                </View>
              </View>
            </ScrollView>

            {/* Boutons d'action */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={closeOrderModal}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveOrderChanges}
                style={styles.saveButton}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Sauvegarder</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Container Web
  containerWeb: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  titleWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  headerWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Container Mobile
  containerMobile: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollViewMobile: {
    flex: 1,
    padding: 16,
  },
  titleMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  headerMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Filtres Web
  filtersContainerWeb: {
    marginBottom: 24,
  },
  filtersScrollView: {
    flexDirection: 'row',
  },
  filterButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActiveWeb: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  filterTextWeb: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActiveWeb: {
    color: '#7C3AED',
  },

  // Filtres Mobile
  filtersContainerMobile: {
    marginBottom: 16,
  },
  filterButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActiveMobile: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  filterTextMobile: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActiveMobile: {
    color: '#7C3AED',
  },

  // Grille des commandes Web
  ordersGridWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Container des commandes Mobile
  ordersContainerMobile: {
    gap: 16,
  },

  // Carte de commande Web
  orderCardWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },

  // Carte de commande Mobile
  orderCardMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
  },

  // En-tête coloré
  orderHeaderColored: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  customerNameHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  orderTimeHeader: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  tableNumberHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Corps de la carte
  orderBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },


  // Liste des articles
  itemsContainer: {
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemNameWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  itemNameMobile: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  itemNotesWeb: {
    fontSize: 12,
    color: '#F59E0B',
    fontStyle: 'italic',
  },
  itemNotesMobile: {
    fontSize: 11,
    color: '#F59E0B',
    fontStyle: 'italic',
  },
  checkIcon: {
    padding: 4,
  },

  // Footer de la commande
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeTextWeb: {
    marginLeft: 4,
    fontSize: 12,
    color: '#6B7280',
  },
  timeTextMobile: {
    marginLeft: 4,
    fontSize: 11,
    color: '#6B7280',
  },
  separator: {
    marginHorizontal: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  estimatedTimeWeb: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  estimatedTimeMobile: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
  },
  totalWeb: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  totalMobile: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  // Boutons d'action
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  startButton: {
    backgroundColor: '#3B82F6',
  },
  readyButton: {
    backgroundColor: '#10B981',
  },
  serveButton: {
    backgroundColor: '#F59E0B',
  },
  actionButtonText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Styles pour la modal de détails de commande
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  modalBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: 500,
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  modalField: {
    marginBottom: 16,
  },
  modalFieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  statusButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  statusButtonActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalItemNotes: {
    fontSize: 14,
    color: '#F59E0B',
    fontStyle: 'italic',
  },
  modalItemQuantity: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 30,
    alignItems: 'center',
  },
  modalItemQuantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  modalTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  modalTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Styles pour le bouton de rafraîchissement
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7C3AED',
  },
  refreshIcon: {
    // Style normal pour l'icône
  },
  refreshIconSpinning: {
    // Animation de rotation pour l'icône (peut être ajoutée avec Animated si nécessaire)
  },
});

export default KitchenComponent;
