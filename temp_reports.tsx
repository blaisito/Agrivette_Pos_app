import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Composant Rapports
const ReportsComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  
  const [activeTab, setActiveTab] = useState<'rapports' | 'filtres'>('rapports');
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [selectedReportType, setSelectedReportType] = useState<'sales' | 'consumption'>('sales');

  // Données simplifiées
  const reportData = {
    sales: {
      today: { amount: 1250, orders: 45, average: 27.78 },
      week: { amount: 8750, orders: 315, average: 27.78 },
      month: { amount: 37500, orders: 1350, average: 27.78 }
    },
    recentOrders: [
      { id: '#001', table: 'T-12', customer: 'Jean Dupont', items: 'Pizza Margherita, Salade César', total: 28.50, time: '14:30', status: 'Terminée' },
      { id: '#002', table: 'T-08', customer: 'Marie Martin', items: 'Pâtes Carbonara, Tiramisu', total: 22.00, time: '14:15', status: 'En cours' },
      { id: '#003', table: 'T-15', customer: 'Pierre Durand', items: 'Burger Deluxe, Frites', total: 18.50, time: '14:45', status: 'En attente' },
      { id: '#004', table: 'T-03', customer: 'Sophie Bernard', items: 'Salade Niçoise, Eau minérale', total: 15.00, time: '14:00', status: 'Terminée' },
      { id: '#005', table: 'T-07', customer: 'Marc Dubois', items: 'Pizza Quatre Fromages, Coca-Cola', total: 24.75, time: '13:45', status: 'Servie' }
    ],
    recentExpenses: [
      { id: 'EXP-001', description: 'Achat de légumes frais', category: 'Ingrédients', amount: 125.50, date: '2024-01-15', supplier: 'Fournisseur Bio', status: 'Payé' },
      { id: 'EXP-002', description: 'Maintenance équipement cuisine', category: 'Équipement', amount: 89.00, date: '2024-01-14', supplier: 'TechService', status: 'En attente' },
      { id: 'EXP-003', description: 'Nettoyage professionnel', category: 'Nettoyage', amount: 45.00, date: '2024-01-13', supplier: 'CleanPro', status: 'Payé' },
      { id: 'EXP-004', description: 'Électricité du mois', category: 'Services', amount: 156.75, date: '2024-01-12', supplier: 'EDF', status: 'Payé' },
      { id: 'EXP-005', description: 'Achat de viande', category: 'Ingrédients', amount: 78.25, date: '2024-01-11', supplier: 'Boucherie Martin', status: 'Payé' }
    ],
    transactions: [
      { type: 'vente', description: 'Commande #001 - Table T-12', amount: 8.63, date: '2024-01-15', customer: 'Jean Dupont', status: 'Terminée' },
      { type: 'depense', description: 'Achat de légumes frais', amount: -125.50, date: '2024-01-15', supplier: 'Fournisseur Bio', status: 'Payé' },
      { type: 'vente', description: 'Commande #002 - Table T-08', amount: 8.05, date: '2024-01-14', customer: 'Marie Martin', status: 'En cours' },
      { type: 'depense', description: 'Maintenance équipement cuisine', amount: -89.00, date: '2024-01-14', supplier: 'TechService', status: 'En attente' },
      { type: 'vente', description: 'Commande #003 - Table T-15', amount: 3.45, date: '2024-01-13', customer: 'Pierre Durand', status: 'En attente' },
      { type: 'depense', description: 'Nettoyage professionnel', amount: -45.00, date: '2024-01-13', supplier: 'CleanPro', status: 'Payé' },
      { type: 'vente', description: 'Commande #004 - Table T-03', amount: 3.91, date: '2024-01-12', customer: 'Sophie Bernard', status: 'Terminée' },
      { type: 'depense', description: 'Électricité du mois', amount: -156.75, date: '2024-01-12', supplier: 'EDF', status: 'Payé' },
      { type: 'vente', description: 'Commande #005 - Table T-07', amount: 6.33, date: '2024-01-11', customer: 'Marc Dubois', status: 'Servie' },
      { type: 'depense', description: 'Achat de viande', amount: -78.25, date: '2024-01-11', supplier: 'Boucherie Martin', status: 'Payé' }
    ],
    consumptionData: [
      { product: 'SIMBA Beer', stockInitial: 50, entreeStock: 0, sortieStock: 2, resteStock: 48, unitPrice: 8.63, total: 17.26 },
      { product: 'CASTLE Beer', stockInitial: 30, entreeStock: 0, sortieStock: 1, resteStock: 29, unitPrice: 8.05, total: 8.05 },
      { product: 'JACK DANIEL S Single Barrel 45% Heritage Whisky', stockInitial: 25, entreeStock: 0, sortieStock: 1, resteStock: 24, unitPrice: 3.45, total: 3.45 },
      { product: 'Amarula 375ml | Bar Keeper', stockInitial: 20, entreeStock: 0, sortieStock: 1, resteStock: 19, unitPrice: 3.91, total: 3.91 }
    ]
  };

  // Données et fonctions simplifiées
  const periods = [
    { key: 'today', label: 'Aujourd\'hui' },
    { key: 'week', label: 'Cette semaine' },
    { key: 'month', label: 'Ce mois' }
  ];

  const currentData = reportData.sales[selectedPeriod as keyof typeof reportData.sales];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Terminée': return '#10B981';
      case 'En cours': return '#3B82F6';
      case 'En attente': return '#F59E0B';
      case 'Servie': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'vente': return '#10B981';
      case 'depense': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'vente': return 'Vente';
      case 'depense': return 'Dépense';
      default: return 'Autre';
    }
  };

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <ScrollView style={[styles.containerWeb, {paddingHorizontal: 140}]}>
        <Text style={styles.titleWeb}>Rapports</Text>
        
        {/* Tabs */}
        <View style={styles.tabsContainerWeb}>
          <TouchableOpacity
            onPress={() => setActiveTab('rapports')}
            style={[styles.tabWeb, activeTab === 'rapports' && styles.tabActiveWeb]}
          >
            <Text style={[styles.tabTextWeb, activeTab === 'rapports' && styles.tabTextActiveWeb]}>
              Rapports
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('filtres')}
            style={[styles.tabWeb, activeTab === 'filtres' && styles.tabActiveWeb]}
          >
            <Text style={[styles.tabTextWeb, activeTab === 'filtres' && styles.tabTextActiveWeb]}>
              Filtres
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'rapports' ? (
          <>
            {/* Sélecteur de période */}
            <View style={styles.periodSelectorWeb}>
              {periods.map((period) => (
                <TouchableOpacity
                  key={period.key}
                  onPress={() => setSelectedPeriod(period.key)}
                  style={[
                    styles.periodButtonWeb,
                    selectedPeriod === period.key && styles.periodButtonActiveWeb
                  ]}
                >
                  <Text style={[
                    styles.periodButtonTextWeb,
                    selectedPeriod === period.key && styles.periodButtonTextActiveWeb
                  ]}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Statistiques principales */}
            <View style={styles.mainStatsWeb}>
              <View style={styles.statCardWeb}>
                <View style={styles.statIconWeb}>
                  <Ionicons name="cash" size={24} color="#10B981" />
                </View>
                <View style={styles.statContentWeb}>
                  <Text style={styles.statValueWeb}>€{currentData.amount.toLocaleString()}</Text>
                  <Text style={styles.statLabelWeb}>Chiffre d'affaires</Text>
                </View>
              </View>
              
              <View style={styles.statCardWeb}>
                <View style={styles.statIconWeb}>
                  <Ionicons name="receipt" size={24} color="#3B82F6" />
                </View>
                <View style={styles.statContentWeb}>
                  <Text style={styles.statValueWeb}>{currentData.orders}</Text>
                  <Text style={styles.statLabelWeb}>Commandes</Text>
                </View>
              </View>
              
              <View style={styles.statCardWeb}>
                <View style={styles.statIconWeb}>
                  <Ionicons name="trending-up" size={24} color="#F59E0B" />
                </View>
                <View style={styles.statContentWeb}>
                  <Text style={styles.statValueWeb}>€{currentData.average.toFixed(2)}</Text>
                  <Text style={styles.statLabelWeb}>Panier moyen</Text>
                </View>
              </View>
              
              <View style={styles.statCardWeb}>
                <View style={styles.statIconWeb}>
                  <Ionicons name="card" size={24} color="#EF4444" />
                </View>
                <View style={styles.statContentWeb}>
                  <Text style={styles.statValueWeb}>€{(currentData.amount * 0.25).toLocaleString()}</Text>
                  <Text style={styles.statLabelWeb}>Dépenses</Text>
                </View>
              </View>
            </View>

            {/* Dernières commandes */}
            <View style={styles.reportSectionWeb}>
              <Text style={styles.sectionTitleWeb}>Dernières Commandes</Text>
              <View style={styles.recentOrdersListWeb}>
                {reportData.recentOrders.map((order, index) => (
                  <View key={index} style={styles.recentOrderWeb}>
                    <View style={styles.orderHeaderWeb}>
                      <View style={styles.orderIdWeb}>
                        <Text style={styles.orderIdTextWeb}>{order.id}</Text>
                      </View>
                      <View style={styles.orderTimeWeb}>
                        <Text style={styles.orderTimeTextWeb}>{order.time}</Text>
                      </View>
                    </View>
                    <View style={styles.orderInfoWeb}>
                      <Text style={styles.customerNameWeb}>{order.customer}</Text>
                      <Text style={styles.tableNumberWeb}>Table {order.table}</Text>
                    </View>
                    <Text style={styles.orderItemsWeb}>{order.items}</Text>
                    <View style={styles.orderFooterWeb}>
                      <Text style={styles.orderTotalWeb}>€{order.total.toFixed(2)}</Text>
                      <View style={[styles.orderStatusWeb, { backgroundColor: getStatusColor(order.status) }]}>
                        <Text style={styles.orderStatusTextWeb}>{order.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Dernières dépenses */}
            <View style={styles.reportSectionWeb}>
              <Text style={styles.sectionTitleWeb}>Dernières Dépenses</Text>
              <View style={styles.expensesListWeb}>
                {reportData.recentExpenses.map((expense, index) => (
                  <View key={index} style={styles.expenseItemWeb}>
                    <View style={styles.expenseHeaderWeb}>
                      <View style={styles.expenseIdWeb}>
                        <Text style={styles.expenseIdTextWeb}>{expense.id}</Text>
                      </View>
                      <View style={styles.expenseDateWeb}>
                        <Text style={styles.expenseDateTextWeb}>{expense.date}</Text>
                      </View>
                    </View>
                    <View style={styles.expenseInfoWeb}>
                      <Text style={styles.expenseDescriptionWeb}>{expense.description}</Text>
                      <Text style={styles.expenseSupplierWeb}>{expense.supplier}</Text>
                    </View>
                    <View style={styles.expenseFooterWeb}>
                      <View style={styles.expenseCategoryWeb}>
                        <Text style={styles.expenseCategoryTextWeb}>{expense.category}</Text>
                      </View>
                      <View style={styles.expenseAmountWeb}>
                        <Text style={styles.expenseAmountTextWeb}>€{expense.amount.toFixed(2)}</Text>
                      </View>
                      <View style={[styles.expenseStatusWeb, { backgroundColor: '#10B981' }]}>
                        <Text style={styles.expenseStatusTextWeb}>{expense.status}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Section Filtres */}
            <View style={styles.filtersSectionWeb}>
              <Text style={styles.sectionTitleWeb}>Filtres</Text>
              
              {/* Navigation des tabs de rapport */}
              <View style={styles.reportTabsWeb}>
                <TouchableOpacity
                  style={[
                    styles.reportTabWeb,
                    selectedReportType === 'sales' && styles.reportTabActiveWeb
                  ]}
                  onPress={() => setSelectedReportType('sales')}
                >
                  <Text style={[
                    styles.reportTabTextWeb,
                    selectedReportType === 'sales' && styles.reportTabTextActiveWeb
                  ]}>
                    Rapport Vente
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.reportTabWeb,
                    selectedReportType === 'consumption' && styles.reportTabActiveWeb
                  ]}
                  onPress={() => setSelectedReportType('consumption')}
                >
                  <Text style={[
                    styles.reportTabTextWeb,
                    selectedReportType === 'consumption' && styles.reportTabTextActiveWeb
                  ]}>
                    Rapport Consommation
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Table des transactions */}
            <View style={styles.tableSectionWeb}>
              <Text style={styles.sectionTitleWeb}>
                {selectedReportType === 'sales' ? `Transactions (${reportData.transactions.length})` : `Consommation (${reportData.consumptionData.length})`}
              </Text>
              <View style={styles.tableWeb}>
                {/* En-têtes de table */}
                <View style={styles.tableHeaderWeb}>
                  {selectedReportType === 'sales' ? (
                    <>
                      <Text style={styles.tableHeaderTextWeb}>Type</Text>
                      <Text style={styles.tableHeaderTextWeb}>Description</Text>
                      <Text style={styles.tableHeaderTextWeb}>Date</Text>
                      <Text style={styles.tableHeaderTextWeb}>Montant</Text>
                      <Text style={styles.tableHeaderTextWeb}>Statut</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.tableHeaderTextWeb}>Produit</Text>
                      <Text style={styles.tableHeaderTextWeb}>Stock Initial</Text>
                      <Text style={styles.tableHeaderTextWeb}>Entrée Stock</Text>
                      <Text style={styles.tableHeaderTextWeb}>Sortie Stock</Text>
                      <Text style={styles.tableHeaderTextWeb}>Reste Stock</Text>
                      <Text style={styles.tableHeaderTextWeb}>Prix Unitaire</Text>
                      <Text style={styles.tableHeaderTextWeb}>Total</Text>
                    </>
                  )}
                </View>
                
                {/* Lignes de données */}
                {selectedReportType === 'sales' ? (
                  reportData.transactions.map((transaction, index) => (
                    <View key={index} style={styles.tableRowWeb}>
                      <View style={[styles.tableCellWeb, styles.typeCellWeb]}>
                        <View style={[styles.typeBadgeWeb, { backgroundColor: getTransactionTypeColor(transaction.type) }]}>
                          <Text style={styles.typeBadgeTextWeb}>
                            {getTransactionTypeLabel(transaction.type)}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{transaction.description}</Text>
                      <Text style={styles.tableCellWeb}>{transaction.date}</Text>
                      <Text style={[
                        styles.tableCellWeb,
                        styles.amountCellWeb,
                        { color: transaction.amount > 0 ? '#10B981' : '#EF4444' }
                      ]}>
                        {transaction.amount > 0 ? '+' : ''}€{Math.abs(transaction.amount).toFixed(2)}
                      </Text>
                      <View style={styles.tableCellWeb}>
                        <View style={[styles.statusBadgeWeb, { backgroundColor: getStatusColor(transaction.status) }]}>
                          <Text style={styles.statusBadgeTextWeb}>{transaction.status}</Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  reportData.consumptionData.map((consumption, index) => (
                    <View key={index} style={styles.tableRowWeb}>
                      <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{consumption.product}</Text>
                      <Text style={styles.tableCellWeb}>{consumption.stockInitial}</Text>
                      <Text style={styles.tableCellWeb}>{consumption.entreeStock}</Text>
                      <Text style={styles.tableCellWeb}>{consumption.sortieStock}</Text>
                      <Text style={styles.tableCellWeb}>{consumption.resteStock}</Text>
                      <Text style={styles.tableCellWeb}>€{consumption.unitPrice.toFixed(2)}</Text>
                      <Text style={[
                        styles.tableCellWeb,
                        styles.amountCellWeb,
                        { color: '#7C3AED' }
                      ]}>
                        €{consumption.total.toFixed(2)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    );
  }

  // Version Mobile/Tablet
  return (
    <ScrollView style={styles.containerMobile}>
      <Text style={styles.titleMobile}>Rapports</Text>
      
      {/* Tabs */}
      <View style={styles.tabsContainerMobile}>
        <TouchableOpacity
          onPress={() => setActiveTab('rapports')}
          style={[styles.tabMobile, activeTab === 'rapports' && styles.tabActiveMobile]}
        >
          <Text style={[styles.tabTextMobile, activeTab === 'rapports' && styles.tabTextActiveMobile]}>
            Rapports
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('filtres')}
          style={[styles.tabMobile, activeTab === 'filtres' && styles.tabActiveMobile]}
        >
          <Text style={[styles.tabTextMobile, activeTab === 'filtres' && styles.tabTextActiveMobile]}>
            Filtres
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'rapports' ? (
        <>
          {/* Sélecteur de période */}
          <View style={styles.periodSelectorMobile}>
            {periods.map((period) => (
              <TouchableOpacity
                key={period.key}
                onPress={() => setSelectedPeriod(period.key)}
                style={[
                  styles.periodButtonMobile,
                  selectedPeriod === period.key && styles.periodButtonActiveMobile
                ]}
              >
                <Text style={[
                  styles.periodButtonTextMobile,
                  selectedPeriod === period.key && styles.periodButtonTextActiveMobile
                ]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Statistiques principales */}
          <View style={styles.mainStatsMobile}>
            <View style={styles.statCardMobile}>
              <View style={styles.statIconMobile}>
                <Ionicons name="cash" size={20} color="#10B981" />
              </View>
              <View style={styles.statContentMobile}>
                <Text style={styles.statValueMobile}>€{currentData.amount.toLocaleString()}</Text>
                <Text style={styles.statLabelMobile}>Chiffre d'affaires</Text>
              </View>
            </View>
            
            <View style={styles.statCardMobile}>
              <View style={styles.statIconMobile}>
                <Ionicons name="receipt" size={20} color="#3B82F6" />
              </View>
              <View style={styles.statContentMobile}>
                <Text style={styles.statValueMobile}>{currentData.orders}</Text>
                <Text style={styles.statLabelMobile}>Commandes</Text>
              </View>
            </View>
            
            <View style={styles.statCardMobile}>
              <View style={styles.statIconMobile}>
                <Ionicons name="trending-up" size={20} color="#F59E0B" />
              </View>
              <View style={styles.statContentMobile}>
                <Text style={styles.statValueMobile}>€{currentData.average.toFixed(2)}</Text>
                <Text style={styles.statLabelMobile}>Panier moyen</Text>
              </View>
            </View>
            
            <View style={styles.statCardMobile}>
              <View style={styles.statIconMobile}>
                <Ionicons name="card" size={20} color="#EF4444" />
              </View>
              <View style={styles.statContentMobile}>
                <Text style={styles.statValueMobile}>€{(currentData.amount * 0.25).toLocaleString()}</Text>
                <Text style={styles.statLabelMobile}>Dépenses</Text>
              </View>
            </View>
          </View>

          {/* Dernières commandes */}
          <View style={styles.reportSectionMobile}>
            <Text style={styles.sectionTitleMobile}>Dernières Commandes</Text>
            <View style={styles.recentOrdersListMobile}>
              {reportData.recentOrders.map((order, index) => (
                <View key={index} style={styles.recentOrderMobile}>
                  <View style={styles.orderHeaderMobile}>
                    <View style={styles.orderIdMobile}>
                      <Text style={styles.orderIdTextMobile}>{order.id}</Text>
                    </View>
                    <View style={styles.orderTimeMobile}>
                      <Text style={styles.orderTimeTextMobile}>{order.time}</Text>
                    </View>
                  </View>
                  <View style={styles.orderInfoMobile}>
                    <Text style={styles.customerNameMobile}>{order.customer}</Text>
                    <Text style={styles.tableNumberMobile}>Table {order.table}</Text>
                  </View>
                  <Text style={styles.orderItemsMobile}>{order.items}</Text>
                  <View style={styles.orderFooterMobile}>
                    <Text style={styles.orderTotalMobile}>€{order.total.toFixed(2)}</Text>
                    <View style={[styles.orderStatusMobile, { backgroundColor: getStatusColor(order.status) }]}>
                      <Text style={styles.orderStatusTextMobile}>{order.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Dernières dépenses */}
          <View style={styles.reportSectionMobile}>
            <Text style={styles.sectionTitleMobile}>Dernières Dépenses</Text>
            <View style={styles.expensesListMobile}>
              {reportData.recentExpenses.map((expense, index) => (
                <View key={index} style={styles.expenseItemMobile}>
                  <View style={styles.expenseHeaderMobile}>
                    <View style={styles.expenseIdMobile}>
                      <Text style={styles.expenseIdTextMobile}>{expense.id}</Text>
                    </View>
                    <View style={styles.expenseDateMobile}>
                      <Text style={styles.expenseDateTextMobile}>{expense.date}</Text>
                    </View>
                  </View>
                  <View style={styles.expenseInfoMobile}>
                    <Text style={styles.expenseDescriptionMobile}>{expense.description}</Text>
                    <Text style={styles.expenseSupplierMobile}>{expense.supplier}</Text>
                  </View>
                  <View style={styles.expenseFooterMobile}>
                    <View style={styles.expenseCategoryMobile}>
                      <Text style={styles.expenseCategoryTextMobile}>{expense.category}</Text>
                    </View>
                    <View style={styles.expenseAmountMobile}>
                      <Text style={styles.expenseAmountTextMobile}>€{expense.amount.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.expenseStatusMobile, { backgroundColor: '#10B981' }]}>
                      <Text style={styles.expenseStatusTextMobile}>{expense.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <>
          {/* Section Filtres - Mobile */}
          <View style={styles.filtersSectionMobile}>
            <Text style={styles.sectionTitleMobile}>Filtres</Text>
            
            {/* Navigation des tabs de rapport */}
            <View style={styles.reportTabsMobile}>
              <TouchableOpacity
                style={[
                  styles.reportTabMobile,
                  selectedReportType === 'sales' && styles.reportTabActiveMobile
                ]}
                onPress={() => setSelectedReportType('sales')}
              >
                <Text style={[
                  styles.reportTabTextMobile,
                  selectedReportType === 'sales' && styles.reportTabTextActiveMobile
                ]}>
                  Rapport Vente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.reportTabMobile,
                  selectedReportType === 'consumption' && styles.reportTabActiveMobile
                ]}
                onPress={() => setSelectedReportType('consumption')}
              >
                <Text style={[
                  styles.reportTabTextMobile,
                  selectedReportType === 'consumption' && styles.reportTabTextActiveMobile
                ]}>
                  Rapport Consommation
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Liste des transactions - Mobile */}
          <View style={styles.listSectionMobile}>
            <Text style={styles.sectionTitleMobile}>
              {selectedReportType === 'sales' ? `Transactions (${reportData.transactions.length})` : `Consommation (${reportData.consumptionData.length})`}
            </Text>
            <View style={styles.transactionsListMobile}>
              {selectedReportType === 'sales' ? (
                reportData.transactions.map((transaction, index) => (
                  <View key={index} style={styles.transactionItemMobile}>
                    <View style={styles.transactionHeaderMobile}>
                      <View style={styles.productInfoMobile}>
                        <Text style={styles.transactionDescriptionMobile}>{transaction.description}</Text>
                        <Text style={styles.transactionDateTextMobile}>{transaction.date}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.transactionFooterMobile}>
                      <View style={[styles.transactionTypeMobile, { backgroundColor: getTransactionTypeColor(transaction.type) }]}>
                        <Text style={styles.transactionTypeTextMobile}>
                          {getTransactionTypeLabel(transaction.type)}
                        </Text>
                      </View>
                      <Text style={[
                        styles.transactionAmountMobile,
                        { color: transaction.amount > 0 ? '#10B981' : '#EF4444' }
                      ]}>
                        {transaction.amount > 0 ? '+' : ''}€{Math.abs(transaction.amount).toFixed(2)}
                      </Text>
                      <View style={[styles.transactionStatusMobile, { backgroundColor: getStatusColor(transaction.status) }]}>
                        <Text style={styles.transactionStatusTextMobile}>{transaction.status}</Text>
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                reportData.consumptionData.map((consumption, index) => (
                  <View key={index} style={styles.transactionItemMobile}>
                    <View style={styles.transactionHeaderMobile}>
                      <View style={styles.productInfoMobile}>
                        <Text style={styles.transactionDescriptionMobile}>{consumption.product}</Text>
                      </View>
                    </View>
                    
                    {/* Informations de stock */}
                    <View style={styles.stockInfoMobile}>
                      <View style={styles.stockRowMobile}>
                        <Text style={styles.stockLabelMobile}>Stock Initial:</Text>
                        <Text style={styles.stockValueMobile}>{consumption.stockInitial}</Text>
                      </View>
                      <View style={styles.stockRowMobile}>
                        <Text style={styles.stockLabelMobile}>Entrée:</Text>
                        <Text style={styles.stockValueMobile}>{consumption.entreeStock}</Text>
                      </View>
                      <View style={styles.stockRowMobile}>
                        <Text style={styles.stockLabelMobile}>Sortie:</Text>
                        <Text style={styles.stockValueMobile}>{consumption.sortieStock}</Text>
                      </View>
                      <View style={styles.stockRowMobile}>
                        <Text style={styles.stockLabelMobile}>Reste:</Text>
                        <Text style={styles.stockValueMobile}>{consumption.resteStock}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.transactionFooterMobile}>
                      <View style={styles.amountsContainerMobile}>
                        <Text style={styles.transactionAmountMobile}>
                          Prix: €{consumption.unitPrice.toFixed(2)}
                        </Text>
                        <Text style={[
                          styles.transactionTotalMobile,
                          { color: '#7C3AED' }
                        ]}>
                          Total: €{consumption.total.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
};

