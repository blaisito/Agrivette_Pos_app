import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getExchangeRate } from '../api/configurationApi';
import { getIntervalMetrics, getProductConsumptionReport, getSellingReport, getTodayDateRange } from '../api/reportApi';
import { getStockMouvementReport, getStockReaprovision, getStockSortie } from '../api/stockReportApi';
import { getDepotCodes, getUsers } from '../api/userApi';
import { getUserData } from '../utils/storage';
import BottomSheetCalendarModal from './ui/BottomSheetCalendarModal';
import CalendarModal from './ui/CalendarModal';

// jsPDF sera importé dynamiquement dans les fonctions qui en ont besoin

// Types pour les données de stock
interface StockData {
  date: string;
  productName: string;
  quantity: number;
  observation?: string;
}

interface StockMovementData {
  productName: string;
  userName: string;
  depotCode: string;
  mouvementType: string;
  transactionType: string;
  description?: string;
  quantity: number;
  transactionDate: string;
  expirationDate?: string;
}

// Type pour la plage de dates
interface DateRange {
  startDate: string;
  endDate: string;
}

// Types pour les données de rapport de vente
interface SellingReportData {
  id: string;
  productId: string;
  productName: string;
  factureId: string;
  factureClient: string;
  tableId: string;
  tableNomination: string;
  userId: string;
  userName: string;
  categoryId?: string;
  priceUsd: number;
  priceCdf: number;
  qte: number;
  taux: number;
  subTotalUsd: number;
  subTotalCdf: number;
  created: string;
  updated: string;
}

// Types pour les données de rapport de consommation
interface ConsumptionReportData {
  productId: string;
  productName: string;
  productDescription: string;
  categoryName: string;
  priceCdf: number;
  totalQuantitySold: number;
  totalRevenueUsd: number;
  totalRevenueCdf: number;
  averagePriceUsd: number;
  averagePriceCdf: number;
  numberOfSales: number;
  firstSaleDate: string;
  lastSaleDate: string;
}

// Types pour les dettes
interface DebtReportData {
  id: string;
  numCode: string | null;
  reductionUsd: number;
  reductionCdf: number;
  client: string;
  taxationUsd: number;
  taxationCdf: number;
  userName: string;
  nbVentes: number;
  qteVentes: number;
  nbPaiement: number;
  montantPayeCdf: number;
  montantPayeUsd: number;
  creditUsd: number;
  creditCdf: number;
  depotCode: string;
  created: string;
}

// Types pour les paiements de factures
interface PaymentReportData {
  id: string;
  typePaiement: string;
  factureId: string;
  numFacture: string;
  client: string;
  reductionUsd: number;
  reductionCdf: number;
  dateCreatedFacture: string;
  montantPayCdf: number;
  montantPayUsd: number;
  taux: number;
  datePaiement: string;
  remboursement: boolean;
  userName: string;
  nbVentes: number;
  qteVentes: number;
  taxationUsd: number;
  taxationCdf: number;
  depotCode: string;
}

// Composant Rapports
const ReportsComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  const isMobile = width < 768;
  const [showPdfOverlay, setShowPdfOverlay] = useState<boolean>(false);
  const [pdfData, setPdfData] = useState<any>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [selectedReportType, setSelectedReportType] = useState<'sales' | 'consumption' | 'stock' | 'debt' | 'payment'>('sales');
  const [userDepotCode, setUserDepotCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [selectedDepotCode, setSelectedDepotCode] = useState<string | null>(null);
  const [depotCodes, setDepotCodes] = useState<string[]>([]);
  const [depotCodesLoading, setDepotCodesLoading] = useState<boolean>(false);
  const [depotCodesError, setDepotCodesError] = useState<string | null>(null);


  function formatDateForAPI(date: Date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }

  // Format pour les endpoints /stock-reaprovision et /stock-sortie (segments d'URL)
  function formatDateForStockPath(date: Date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Format spécifique pour l'API stock-mouvement (MM/DD/YYYY HH:MM)
  function formatDateForStockMovement(date: Date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  }

  // Initialize with today's date range
  const safeParseDate = (value: string): Date | null => {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Essayer de remplacer les tirets par des slashs
    const normalized = value.replace(/-/g, '/');
    const normalizedParsed = new Date(normalized);
    if (!isNaN(normalizedParsed.getTime())) {
      return normalizedParsed;
    }

    return null;
  };

  const getTodayDateRangeSafe = (): DateRange => {
    try {
      const range = getTodayDateRange() as any;

      if (range && range.startDate && range.endDate) {
        const start = safeParseDate(range.startDate);
        const end = safeParseDate(range.endDate);

        if (start && end) {
          return {
            startDate: formatDateForAPI(start),
            endDate: formatDateForAPI(end),
          };
        }
      }
    } catch (error) {
      console.error('❌ Error getting date range:', error);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 0, 0);

    return {
      startDate: formatDateForAPI(todayStart),
      endDate: formatDateForAPI(todayEnd),
    };
  };

  const [dateRange, setDateRange] = useState<DateRange>(getTodayDateRangeSafe());

  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  // États pour le CalendarModal
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);

  // États pour les modals de calendrier mobile (bottom sheet)
  const [showMobileStartDateModal, setShowMobileStartDateModal] = useState(false);
  const [showMobileEndDateModal, setShowMobileEndDateModal] = useState(false);

  // États pour les dates (format Date pour le CalendarModal)
  const [startDate, setStartDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
  });

  // États pour le calendrier existant (à supprimer progressivement)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateType, setCurrentDateType] = useState<'start' | 'end'>('start');
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // États pour les données de stock
  const [stockReaprovisionData, setStockReaprovisionData] = useState<StockData[]>([]);
  const [stockSortieData, setStockSortieData] = useState<StockData[]>([]);
  const [stockMovementData, setStockMovementData] = useState<StockMovementData[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  
  // États pour les filtres des mouvements de stock
  const [stockMovementFilter, setStockMovementFilter] = useState<'all' | 'sortie' | 'entree'>('all');
  const [stockMovementSearch, setStockMovementSearch] = useState<string>('');

  // États pour les données de rapport de vente
  const [sellingReportData, setSellingReportData] = useState<SellingReportData[]>([]);
  const [sellingReportLoading, setSellingReportLoading] = useState(false);
  const [sellingReportError, setSellingReportError] = useState<string | null>(null);

  // États pour les métriques d'intervalle
  const [intervalMetrics, setIntervalMetrics] = useState<{
    totalFactureAmountAfterReductionUsd: number;
    totalFactureAmountAfterReductionCdf: number;
  } | null>(null);
  const [intervalMetricsLoading, setIntervalMetricsLoading] = useState(false);
  const [intervalMetricsError, setIntervalMetricsError] = useState<string | null>(null);

  // États pour les données de rapport de consommation
  const [consumptionReportData, setConsumptionReportData] = useState<ConsumptionReportData[]>([]);
  const [consumptionReportLoading, setConsumptionReportLoading] = useState(false);
  const [consumptionReportError, setConsumptionReportError] = useState<string | null>(null);

  // États pour les dettes
  const [debtReportData, setDebtReportData] = useState<DebtReportData[]>([]);
  const [debtReportLoading, setDebtReportLoading] = useState(false);
  const [debtReportError, setDebtReportError] = useState<string | null>(null);
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<DebtReportData | null>(null);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [debtPayments, setDebtPayments] = useState<any[]>([]);
  const [debtPaymentsLoading, setDebtPaymentsLoading] = useState(false);
  const [debtPaymentsError, setDebtPaymentsError] = useState<string | null>(null);
  const [debtPaymentTab, setDebtPaymentTab] = useState<'list' | 'pay'>('list');
  const [paymentDevise, setPaymentDevise] = useState<1 | 2>(1); // 1=USD, 2=CDF
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentObservation, setPaymentObservation] = useState<string>('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [debtSearch, setDebtSearch] = useState<string>('');

  // États pour les paiements de factures
  const [paymentReportData, setPaymentReportData] = useState<PaymentReportData[]>([]);
  const [paymentReportLoading, setPaymentReportLoading] = useState(false);
  const [paymentReportError, setPaymentReportError] = useState<string | null>(null);
  const [paymentSearch, setPaymentSearch] = useState<string>('');

  // États pour le taux de change
  const [exchangeRate, setExchangeRate] = useState<number>(2500); // Valeur par défaut
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  const [exchangeRateError, setExchangeRateError] = useState<string | null>(null);

  // États pour les utilisateurs et le filtre
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // États pour les catégories et le filtre
  const [categories, setCategories] = useState<any[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

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

  // Configuration des onglets de rapport
  const reportTabsConfig: Array<{
    key: 'sales' | 'consumption' | 'stock' | 'debt' | 'payment';
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
      { key: 'sales', label: 'Ventes & Consommation', icon: 'trending-up' },
      { key: 'consumption', label: 'Rapport Consommation', icon: 'stats-chart' },
      { key: 'stock', label: 'Rapport des stocks', icon: 'cube' },
      { key: 'debt', label: 'Rapport des dettes', icon: 'alert-circle' },
      { key: 'payment', label: 'Rapport paiements facture', icon: 'card' }
    ];

  // Données et fonctions simplifiées
  const currentData = reportData.sales.today; // Utilise toujours les données d'aujourd'hui

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

  // Fonction pour formater les dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Fonction pour charger les données de rapport de vente
  const loadSellingReportData = async () => {
    setSellingReportLoading(true);
    setSellingReportError(null);

    const effectiveDepotCode = selectedDepotCode || userDepotCode || '';

    if (!effectiveDepotCode) {
      setSellingReportError('Aucun dépôt disponible pour charger le rapport.');
      setSellingReportData([]);
      setSellingReportLoading(false);
      return;
    }

    const response = await getSellingReport(
      dateRange.startDate,
      dateRange.endDate,
      effectiveDepotCode
    );

    if (response.success === false) {
      setSellingReportError(response.error || 'Erreur lors du chargement du rapport de vente');
      setSellingReportData([]);
    } else {
      // L'API renvoie maintenant un objet { data: { sellingReports: [...], depenses: [...] }, success, ... }
      // On lit donc spécifiquement la liste des ventes dans data.sellingReports
      const apiPayload = response?.data;
      setSellingReportData(apiPayload?.sellingReports || []);
    }

    setSellingReportLoading(false);
  };

  // Fonction pour charger les métriques d'intervalle
  const loadIntervalMetrics = async () => {
    setIntervalMetricsLoading(true);
    setIntervalMetricsError(null);

    const effectiveDepotCode = selectedDepotCode || userDepotCode || '';

    if (!effectiveDepotCode) {
      setIntervalMetricsError('Aucun dépôt disponible pour charger les métriques.');
      setIntervalMetrics(null);
      setIntervalMetricsLoading(false);
      return;
    }

    const response = await getIntervalMetrics(
      dateRange.startDate,
      dateRange.endDate,
      effectiveDepotCode
    );

    if (response.success === false) {
      setIntervalMetricsError(response.error || 'Erreur lors du chargement des métriques d\'intervalle');
      setIntervalMetrics(null);
    } else {
      const apiData = response?.data;
      if (apiData) {
        setIntervalMetrics({
          totalFactureAmountAfterReductionUsd: apiData.totalFactureAmountAfterReductionUsd || 0,
          totalFactureAmountAfterReductionCdf: apiData.totalFactureAmountAfterReductionCdf || 0,
        });
      } else {
        setIntervalMetrics(null);
      }
    }

    setIntervalMetricsLoading(false);
  };

  // Fonction pour charger les données de rapport de consommation
  const loadConsumptionReportData = async () => {
    setConsumptionReportLoading(true);
    setConsumptionReportError(null);

    const response = await getProductConsumptionReport(dateRange.startDate, dateRange.endDate);

    if (response.success === false) {
      setConsumptionReportError(response.error || 'Erreur lors du chargement du rapport de consommation');
      setConsumptionReportData([]);
    } else {
      setConsumptionReportData(response?.data || []);
    }

    setConsumptionReportLoading(false);
  };

  // Fonction pour charger les factures en dette
  const loadDebtReportData = async () => {
    setDebtReportLoading(true);
    setDebtReportError(null);
    setExpandedDebtId(null);
    setSelectedDebt(null);
    setShowDebtModal(false);

    try {
      const response = await fetch('https://www.restau3.somee.com/api/v1.0/Report/facture-credit-report', {
        method: 'GET',
        headers: { accept: '*/*' }
      });

      if (!response.ok) {
        throw new Error(`Statut ${response.status}`);
      }

      const json = await response.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setDebtReportData(list);
    } catch (error: any) {
      console.error('Erreur lors du chargement du rapport de dettes:', error);
      setDebtReportError('Erreur lors du chargement du rapport de dettes');
      setDebtReportData([]);
    } finally {
      setDebtReportLoading(false);
    }
  };

  const toggleDebtDetails = (id: string) => {
    setExpandedDebtId(prev => (prev === id ? null : id));
  };

  const filteredDebtReportData = useMemo(() => {
    if (!debtSearch.trim()) return debtReportData;
    const term = debtSearch.trim().toLowerCase();
    return debtReportData.filter(item =>
      (item.numCode || '').toLowerCase().includes(term) ||
      (item.client || '').toLowerCase().includes(term)
    );
  }, [debtReportData, debtSearch]);

  const filteredPaymentReportData = useMemo(() => {
    if (!paymentSearch.trim()) return paymentReportData;
    const term = paymentSearch.trim().toLowerCase();
    return paymentReportData.filter(item =>
      (item.numFacture || '').toLowerCase().includes(term) ||
      (item.client || '').toLowerCase().includes(term) ||
      (item.userName || '').toLowerCase().includes(term) ||
      (item.depotCode || '').toLowerCase().includes(term)
    );
  }, [paymentReportData, paymentSearch]);

  const loadDebtPayments = async (factureId: string) => {
    setDebtPaymentsLoading(true);
    setDebtPaymentsError(null);
    try {
      const response = await fetch(`https://www.restau3.somee.com/api/v1.0/Facture/payments/${factureId}`, {
        method: 'GET',
        headers: { accept: '*/*' }
      });
      if (!response.ok) {
        throw new Error(`Statut ${response.status}`);
      }
      const json = await response.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setDebtPayments(list);
    } catch (error: any) {
      console.error('Erreur lors du chargement des paiements de facture:', error);
      setDebtPayments([]);
      setDebtPaymentsError('Erreur lors du chargement des paiements');
    } finally {
      setDebtPaymentsLoading(false);
    }
  };

  // Fonction pour charger le rapport des paiements de factures
  const loadPaymentReportData = async () => {
    setPaymentReportLoading(true);
    setPaymentReportError(null);
    try {
      const start = formatDateForStockMovement(startDate);
      const end = formatDateForStockMovement(endDate);
      const url = `https://www.restau3.somee.com/api/v1.0/Report/facture-payment-report?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
      const response = await fetch(url, { method: 'GET', headers: { accept: '*/*' } });
      if (!response.ok) {
        throw new Error(`Statut ${response.status}`);
      }
      const json = await response.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setPaymentReportData(list);
    } catch (error) {
      console.error('Erreur lors du chargement du rapport des paiements:', error);
      setPaymentReportError('Erreur lors du chargement du rapport des paiements');
      setPaymentReportData([]);
    } finally {
      setPaymentReportLoading(false);
    }
  };

  const handleOpenDebtModal = (item: DebtReportData) => {
    setSelectedDebt(item);
    setShowDebtModal(true);
    setDebtPaymentTab('list');
    setPaymentDevise(1);
    setPaymentAmount('');
    setPaymentObservation('');
    setPaymentError(null);
    loadDebtPayments(item.id);
  };

  const handleSubmitDebtPayment = async () => {
    if (!selectedDebt) return;
    setPaymentError(null);
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Montant invalide');
      return;
    }

    if (paymentDevise === 1 && amountNum > selectedDebt.creditUsd) {
      setPaymentError('Montant USD supérieur au crédit restant');
      return;
    }
    if (paymentDevise === 2 && amountNum > selectedDebt.creditCdf) {
      setPaymentError('Montant CDF supérieur au crédit restant');
      return;
    }

    setPaymentSubmitting(true);
    try {
      const body = {
        factureId: selectedDebt.id,
        amount: amountNum,
        devise: paymentDevise,
        taux: exchangeRate,
        observation: paymentObservation
      };

      const response = await fetch('https://www.restau3.somee.com/api/v1.0/Facture/payments/add', {
        method: 'POST',
        headers: {
          accept: '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Statut ${response.status}`);
      }

      await loadDebtPayments(selectedDebt.id);
      await loadDebtReportData(); // rafraîchir les crédits
      setPaymentAmount('');
      setPaymentObservation('');
      setDebtPaymentTab('list');
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout du paiement:', error);
      setPaymentError('Erreur lors de l\'ajout du paiement');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  // Fonction pour charger les données de stock
  const loadStockData = async () => {
    setStockLoading(true);
    setStockError(null);

    try {
      const startDateFormatted = formatDateForStockPath(startDate); // YYYY-MM-DD pour réappro/sortie
      const endDateFormatted = formatDateForStockPath(endDate);
      const startDateStock = formatDateForStockMovement(startDate);
      const endDateStock = formatDateForStockMovement(endDate);
      const effectiveDepotCode = selectedDepotCode || userDepotCode || '';

      const [reaprovisionResult, sortieResult, mouvementResult] = await Promise.allSettled([
        getStockReaprovision(startDateFormatted, endDateFormatted),
        getStockSortie(startDateFormatted, endDateFormatted),
        getStockMouvementReport(startDateStock, endDateStock, effectiveDepotCode)
      ]);

      if (reaprovisionResult.status === 'fulfilled') {
        setStockReaprovisionData(reaprovisionResult.value?.data || []);
      } else {
        console.warn('Réapprovisionnement échoué:', reaprovisionResult.reason);
        setStockReaprovisionData([]);
      }

      if (sortieResult.status === 'fulfilled') {
        setStockSortieData(sortieResult.value?.data || []);
      } else {
        console.warn('Sorties échouées:', sortieResult.reason);
        setStockSortieData([]);
      }

      if (mouvementResult.status === 'fulfilled') {
        const mouvementList = mouvementResult.value?.data || mouvementResult.value || [];
        setStockMovementData(Array.isArray(mouvementList) ? mouvementList : []);
      } else {
        console.warn('Mouvements échoués:', mouvementResult.reason);
        setStockMovementData([]);
      }

      // Si tout échoue, lever une erreur pour afficher le message global
      if (
        reaprovisionResult.status === 'rejected' &&
        sortieResult.status === 'rejected' &&
        mouvementResult.status === 'rejected'
      ) {
        throw new Error('Impossible de charger les données de stock');
      }
    } catch (error) {
      setStockError('Erreur lors du chargement des données de stock');
      console.error('Erreur lors du chargement des données de stock:', error);
    } finally {
      setStockLoading(false);
    }
  };

  // Fonction pour charger le taux de change
  const loadExchangeRate = async () => {
    setExchangeRateLoading(true);
    setExchangeRateError(null);

    try {
      const rate = await getExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.error('Erreur lors du chargement du taux de change:', error);
      setExchangeRateError('Erreur lors du chargement du taux de change');
      // Garder la valeur par défaut de 2500
    } finally {
      setExchangeRateLoading(false);
    }
  };

  // Fonction pour charger les utilisateurs
  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);

    try {
      const response = await getUsers();
      if (response.success) {
        setUsers(response.data || []);
      } else {
        setUsersError(response.message || 'Erreur lors du chargement des utilisateurs');
        setUsers([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      setUsersError('Erreur lors du chargement des utilisateurs');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  // Fonction pour charger les catégories
  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);

    try {
      const response = await fetch('https://restotest.somee.com/api/v1/Category/get-all', {
        method: 'GET',
        headers: {
          'accept': '*/*'
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Gérer différents formats de réponse de l'API
        if (Array.isArray(data)) {
          setCategories(data);
        } else if (data && Array.isArray(data.data)) {
          setCategories(data.data);
        } else if (data && Array.isArray(data.categories)) {
          setCategories(data.categories);
        } else {
          setCategories([]);
        }
      } else {
        setCategoriesError('Erreur lors du chargement des catégories');
        setCategories([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
      setCategoriesError('Erreur lors du chargement des catégories');
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadDepotCodes = async () => {
    setDepotCodesLoading(true);
    setDepotCodesError(null);
    try {
      const response = await getDepotCodes();
      let codes: string[] = [];
      if (response?.data && Array.isArray(response.data)) {
        codes = response.data;
      } else if (Array.isArray(response)) {
        codes = response;
      }
      const normalizedCodes = codes
        .filter(code => typeof code === 'string' && code.trim() !== '')
        .map(code => code.trim());
      setDepotCodes(normalizedCodes);
      if (normalizedCodes.length === 0) {
        setDepotCodesError('Aucun dépôt disponible.');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des dépôts:', error);
      setDepotCodesError('Erreur lors du chargement des dépôts');
      setDepotCodes([]);
    } finally {
      setDepotCodesLoading(false);
    }
  };

  // Load exchange rate, users and categories when component mounts
  useEffect(() => {
    loadExchangeRate();
    loadUsers();
    loadCategories();
  }, []);

  useEffect(() => {
    const loadUserContext = async () => {
      try {
        const user = await getUserData();
        if (user?.depotCode) {
          setUserDepotCode(user.depotCode);
          setSelectedDepotCode(prev => prev || user.depotCode);
        }
        const claims: string[] = Array.isArray(user?.claims) ? (user.claims as string[]) : [];
        const hasAdminClaim = claims.some(
          (claim: string) => typeof claim === 'string' && claim.toLowerCase() === 'admin'
        );
        setIsAdmin(hasAdminClaim);
      } catch (error) {
        console.error('Erreur lors du chargement des informations utilisateur:', error);
      }
    };

    loadUserContext();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadDepotCodes();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      // Ne réinitialiser que si selectedDepotCode est null (pas si c'est '' qui représente "Tout")
      if (selectedDepotCode === null && depotCodes.length > 0) {
        setSelectedDepotCode(depotCodes[0]);
      }
    } else if (userDepotCode && selectedDepotCode !== userDepotCode && selectedDepotCode !== '') {
      setSelectedDepotCode(userDepotCode);
    }
  }, [isAdmin, userDepotCode, depotCodes, selectedDepotCode]);

  // Load data when component mounts or date range changes
  useEffect(() => {
    if (selectedReportType === 'sales') {
      loadSellingReportData();
      loadIntervalMetrics();
    } else if (selectedReportType === 'consumption') {
      loadConsumptionReportData();
    } else if (selectedReportType === 'stock') {
      loadStockData();
    } else if (selectedReportType === 'debt') {
      loadDebtReportData();
    } else if (selectedReportType === 'payment') {
      loadPaymentReportData();
    }
  }, [selectedReportType, dateRange]);

  useEffect(() => {
    if (selectedReportType === 'sales') {
      loadSellingReportData();
      loadIntervalMetrics();
    } else if (selectedReportType === 'stock') {
      loadStockData();
    }
  }, [selectedDepotCode, selectedReportType]);

  // Calculate summary data for selling report
  const filteredSellingReportData = sellingReportData.filter(sale => {
    const userMatch = !selectedUserId || sale.userId === selectedUserId;
    // Filtre par catégorie désactivé - toujours true
    const categoryMatch = true; // !selectedCategoryId || sale.categoryId === selectedCategoryId;
    return userMatch && categoryMatch;
  });

  const sellingReportSummary = {
    totalRevenueUsd: filteredSellingReportData.reduce((sum, item) => sum + (item.subTotalCdf / item.taux), 0),
    totalRevenueCdf: filteredSellingReportData.reduce((sum, item) => sum + item.subTotalCdf, 0),
    totalQuantity: filteredSellingReportData.reduce((sum, item) => sum + item.qte, 0),
    totalTransactions: filteredSellingReportData.length,
    averageOrderValue: filteredSellingReportData.length > 0 ?
      filteredSellingReportData.reduce((sum, item) => sum + (item.subTotalCdf / item.taux), 0) / filteredSellingReportData.length : 0
  };

  // Calculate summary data for consumption report
  const consumptionReportSummary = {
    totalProducts: consumptionReportData.length,
    totalQuantitySold: consumptionReportData.reduce((sum, item) => sum + item.totalQuantitySold, 0),
    totalRevenueUsd: consumptionReportData.reduce((sum, item) => sum + item.totalRevenueUsd, 0),
    totalRevenueCdf: consumptionReportData.reduce((sum, item) => sum + item.totalRevenueCdf, 0),
    totalSales: consumptionReportData.reduce((sum, item) => sum + item.numberOfSales, 0)
  };

  // Filtrer les données de mouvement de stock
  const filteredStockMovementData = useMemo(() => {
    return stockMovementData.filter(item => {
      // Filtre par type de mouvement
      const mouvementMatch = stockMovementFilter === 'all' || 
        (stockMovementFilter === 'sortie' && item.mouvementType?.toLowerCase() === 'sortie') ||
        (stockMovementFilter === 'entree' && item.mouvementType?.toLowerCase() !== 'sortie');
      
      // Filtre par recherche de nom de produit
      const searchMatch = !stockMovementSearch || 
        item.productName?.toLowerCase().includes(stockMovementSearch.toLowerCase());
      
      return mouvementMatch && searchMatch;
    });
  }, [stockMovementData, stockMovementFilter, stockMovementSearch]);

  // Fonction pour sélectionner une transaction
  const selectTransaction = (transaction: any) => {
    setSelectedTransaction(transaction);
  };

  // Fonction pour revenir au tableau
  const backToTable = () => {
    setSelectedTransaction(null);
  };

  // Fonction pour formater les dates pour l'affichage
  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fonctions pour le CalendarModal
  const handleStartDateSelect = (selectedDate: Date) => {
    const normalizedDate = new Date(selectedDate);
    normalizedDate.setSeconds(0, 0);
    setStartDate(normalizedDate);
    const formattedDate = formatDateForAPI(normalizedDate);
    setDateRange({ ...dateRange, startDate: formattedDate });
    setShowStartDateModal(false);
  };

  const handleEndDateSelect = (selectedDate: Date) => {
    const normalizedDate = new Date(selectedDate);
    normalizedDate.setSeconds(0, 0);
    setEndDate(normalizedDate);
    const formattedDate = formatDateForAPI(normalizedDate);
    setDateRange({ ...dateRange, endDate: formattedDate });
    setShowEndDateModal(false);
  };

  // Fonctions pour le BottomSheetCalendarModal mobile
  const handleMobileStartDateSelect = (selectedDate: Date) => {
    const normalizedDate = new Date(selectedDate);
    normalizedDate.setSeconds(0, 0);
    setStartDate(normalizedDate);
    const formattedDate = formatDateForAPI(normalizedDate);
    setDateRange({ ...dateRange, startDate: formattedDate });
    setShowMobileStartDateModal(false);
  };

  const handleMobileEndDateSelect = (selectedDate: Date) => {
    const normalizedDate = new Date(selectedDate);
    normalizedDate.setSeconds(0, 0);
    setEndDate(normalizedDate);
    const formattedDate = formatDateForAPI(normalizedDate);
    setDateRange({ ...dateRange, endDate: formattedDate });
    setShowMobileEndDateModal(false);
  };

  // Fonctions pour le calendrier existant (à supprimer progressivement)
  const openDatePicker = (dateType: 'start' | 'end') => {
    setCurrentDateType(dateType);
    setShowDatePicker(true);
  };

  const closeDatePicker = () => {
    setShowDatePicker(false);
  };

  const selectDate = (day: number, month: number, year: number) => {
    const baseDate = new Date(year, month - 1, day);
    if (currentDateType === 'start') {
      baseDate.setHours(0, 0, 0, 0);
      setStartDate(baseDate);
      setDateRange({ ...dateRange, startDate: formatDateForAPI(baseDate) });
    } else {
      baseDate.setHours(23, 59, 0, 0);
      setEndDate(baseDate);
      setDateRange({ ...dateRange, endDate: formatDateForAPI(baseDate) });
    }

    closeDatePicker();
  };

  // Fonctions de navigation du calendrier
  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  // Fonction pour formater le mois et l'année
  const formatMonthYear = (month: number, year: number) => {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return `${monthNames[month]} ${year}`;
  };

  // Fonction pour imprimer les rapports en PDF
  const handlePrintReport = (reportType: 'sales' | 'consumption' | 'stock' | 'debt' | 'payment') => {
    const data = reportType === 'sales' ? filteredSellingReportData :
      reportType === 'consumption' ? consumptionReportData :
        reportType === 'stock' ? stockMovementData :
          reportType === 'debt' ? filteredDebtReportData : filteredPaymentReportData;

    if (!data || data.length === 0) {
      alert('Aucune donnée à imprimer.');
      return;
    }

    // Pour mobile, afficher la vue PDF complète
    if (Platform.OS !== 'web') {
      const reportTitle = reportType === 'sales' ? 'Rapport de Vente' :
        reportType === 'consumption' ? 'Rapport de Consommation' :
          'Rapport des Mouvements de Stock';
      setPdfTitle(reportTitle);
      setPdfData(data);
      setPdfPreviewHtml('');
      setShowPdfOverlay(true);
      return;
    }

    try {
      const reportTitle = reportType === 'sales' ? 'Rapport de Vente' :
        reportType === 'consumption' ? 'Rapport de Consommation' :
          reportType === 'stock' ? 'Rapport des Mouvements de Stock' :
            reportType === 'debt' ? 'Rapport des dettes' : 'Rapport des paiements facture';
      const currentDate = new Date().toLocaleDateString('fr-FR');
      const startDateFormatted = formatDateForDisplay(startDate);
      const endDateFormatted = formatDateForDisplay(endDate);

      // Générer le HTML pour l'impression
      const printHTML = generatePrintHTML(reportType, data, reportTitle, currentDate, startDateFormatted, endDateFormatted);

      setPdfTitle(reportTitle);
      setPdfData(data);
      setPdfPreviewHtml(printHTML);
      setShowPdfOverlay(true);
    } catch (error) {
      console.error('❌ Erreur lors de l\'impression:', error);
      alert('Erreur lors de l\'impression. Vérifiez la console pour plus de détails.');
    }
  };

  // Fonctions pour le partage PDF (mobile uniquement)
  const handleShareWhatsApp = () => {
    const reportText = generateReportText();
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(reportText)}`;

    Linking.openURL(whatsappUrl).catch(() => {
      alert('WhatsApp n\'est pas installé sur cet appareil.');
    });
  };

  const handleShareEmail = () => {
    const reportText = generateReportText();
    const subject = pdfTitle;

    const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reportText)}`;

    Linking.openURL(emailUrl).catch(() => {
      alert('Aucune application email n\'est configurée sur cet appareil.');
    });
  };

  const generateReportText = () => {
    if (!pdfData || pdfData.length === 0) return '';

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const startDate = new Date(dateRange.startDate).toLocaleDateString('fr-FR');
    const endDate = new Date(dateRange.endDate).toLocaleDateString('fr-FR');

    let text = `${pdfTitle}\n`;
    text += `Période: ${startDate} - ${endDate}\n`;
    text += `Généré le: ${currentDate}\n\n`;

    if (pdfTitle.includes('Vente')) {
      const summary = sellingReportSummary;
      text += `RÉSUMÉ DES VENTES:\n`;
      text += `- Chiffre d'affaires USD: $${summary.totalRevenueUsd.toFixed(2)}\n`;
      text += `- Chiffre d'affaires CDF: ${summary.totalRevenueCdf.toLocaleString()} CDF\n`;
      text += `- Transactions: ${summary.totalTransactions}\n`;
      text += `- Quantité vendue: ${summary.totalQuantity}\n\n`;

      text += `DÉTAIL DES VENTES:\n`;
      pdfData.forEach((sale: any, index: number) => {
        text += `${index + 1}. ${sale.productName} - ${sale.factureClient} - Table: ${sale.tableNomination}\n`;
        text += `   Quantité: ${sale.qte} - Prix: $${sale.subTotalUsd.toFixed(2)} / ${sale.subTotalCdf.toLocaleString()} CDF\n`;
        text += `   Date: ${new Date(sale.created).toLocaleDateString('fr-FR')} - Utilisateur: ${sale.userName}\n\n`;
      });
    } else {
      const summary = consumptionReportSummary;
      text += `RÉSUMÉ DE CONSOMMATION:\n`;
      text += `- Produits: ${summary.totalProducts}\n`;
      text += `- Quantité vendue: ${summary.totalQuantitySold}\n`;
      text += `- Revenus USD: $${summary.totalRevenueUsd.toFixed(2)}\n`;
      text += `- Revenus CDF: ${summary.totalRevenueCdf.toLocaleString()} CDF\n`;
      text += `- Nombre de ventes: ${summary.totalSales}\n\n`;

      text += `DÉTAIL PAR PRODUIT:\n`;
      pdfData.forEach((item: any, index: number) => {
        text += `${index + 1}. ${item.productName} (${item.categoryName})\n`;
        text += `   Quantité vendue: ${item.totalQuantitySold}\n`;
        text += `   Revenus: $${item.totalRevenueUsd.toFixed(2)} / ${item.totalRevenueCdf.toLocaleString()} CDF\n`;
        text += `   Ventes: ${item.numberOfSales}\n`;
        text += `   Période: ${new Date(item.firstSaleDate).toLocaleDateString('fr-FR')} - ${new Date(item.lastSaleDate).toLocaleDateString('fr-FR')}\n\n`;
      });
    }

    return text;
  };

  const closePdfPreview = () => {
    setShowPdfOverlay(false);
    setPdfPreviewHtml('');
  };

  const handlePrintFromPreview = () => {
    if (Platform.OS !== 'web') return;
    const iframeWindow = iframeRef.current?.contentWindow;
    if (iframeWindow) {
      iframeWindow.focus();
      iframeWindow.print();
    }
  };

  // Fonction pour générer le HTML d'impression
  const generatePrintHTML = (reportType: 'sales' | 'consumption' | 'stock' | 'debt' | 'payment', data: any[], reportTitle: string, currentDate: string, startDate: string, endDate: string) => {
    let tableHTML = '';

    if (reportType === 'stock') {
      tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #7C3AED; color: white;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Produit</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Mouvement</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Type</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Utilisateur</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Dépôt</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Expiration</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => {
        const isSortie = item.mouvementType?.toLowerCase() === 'sortie';
        const quantityPrefix = isSortie ? '-' : '+';
        const quantityColor = isSortie ? '#DC2626' : '#059669';
        const quantityBg = isSortie ? '#FEE2E2' : '#D1FAE5';
        return `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(item.transactionDate).toLocaleDateString('fr-FR')} ${new Date(item.transactionDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.productName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.mouvementType || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.transactionType || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                  <span style="background-color: ${quantityBg}; color: ${quantityColor}; padding: 4px 8px; border-radius: 12px; font-weight: 600; font-size: 11pt;">
                    ${quantityPrefix}${item.quantity || 0}
                  </span>
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.userName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.depotCode || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('fr-FR') : '-'}</td>
              </tr>
            `;
      }).join('')}
          </tbody>
        </table>
      `;
    } else if (reportType === 'sales') {
      tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #7C3AED; color: white;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Produit</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Client</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Table</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Prix Unitaire</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Prix USD * Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Utilisateur</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.productName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.factureClient || 'Anonyme'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.tableNomination || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">USD ${(item.priceUsd || 0).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.qte || '0'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${(item.subTotalUsd || 0).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.userName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(item.created).toLocaleDateString('fr-FR')} ${new Date(item.created).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (reportType === 'consumption') {
      tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #7C3AED; color: white;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Catégorie</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Produit</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Prix unitaire CDF</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Prix unitaire USD</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Prix unitaire CDF * Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Prix unitaire USD * Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Ventes</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Période</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.categoryName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.productName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.totalQuantitySold || '0'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">CDF ${(item.totalQuantitySold ? (item.totalRevenueCdf / item.totalQuantitySold).toFixed(2) : '0.00')}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">USD ${(item.totalQuantitySold ? (item.totalRevenueUsd / item.totalQuantitySold).toFixed(2) : '0.00')}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">CDF ${(item.totalRevenueCdf || 0).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">USD ${(item.totalRevenueUsd || 0).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.numberOfSales || '0'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                  ${new Date(item.firstSaleDate).toLocaleDateString('fr-FR')} ${new Date(item.firstSaleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  <br/>- ${new Date(item.lastSaleDate).toLocaleDateString('fr-FR')} ${new Date(item.lastSaleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (reportType === 'payment') {
      tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #7C3AED; color: white;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Facture</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Client</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Utilisateur</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Dépôt</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Type paiement</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Taux</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Payé USD / CDF</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Facture USD / CDF</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date paiement</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.numFacture || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.client || 'Anonyme'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.userName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.depotCode || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.typePaiement || ''}${item.remboursement ? ' (Remboursement)' : ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.taux ?? '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">
                  $${(item.montantPayUsd ?? 0).toFixed(2)} / ${(item.montantPayCdf ?? 0).toLocaleString()} CDF
                </td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">
                  $${(item.taxationUsd ?? 0).toFixed(2)} / ${(item.taxationCdf ?? 0).toLocaleString()} CDF
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                  ${new Date(item.datePaiement).toLocaleDateString('fr-FR')} ${new Date(item.datePaiement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #7C3AED; color: white;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Code</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Client</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Utilisateur</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Dépôt</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Ventes</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Crédit USD / CDF</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Payé USD / CDF</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Réduction USD / CDF</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(item => `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.numCode || '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.client || 'Anonyme'}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.userName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.depotCode || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.nbVentes ?? '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.qteVentes ?? '-'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #EF4444;">
                  $${(item.creditUsd ?? 0).toFixed(2)} / ${(item.creditCdf ?? 0).toLocaleString()} CDF
                </td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">
                  $${(item.montantPayeUsd ?? 0).toFixed(2)} / ${(item.montantPayeCdf ?? 0).toLocaleString()} CDF
                </td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">
                  $${(item.reductionUsd ?? 0).toFixed(2)} / ${(item.reductionCdf ?? 0).toLocaleString()} CDF
                </td>
                <td style="border: 1px solid #ddd; padding: 8px;">${formatDate(item.created)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${reportTitle} - AGRIVET-CONGO</title>
        <style>
          @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
            @page { margin: 1cm; }
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.4;
            margin: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #7C3AED;
            padding-bottom: 20px;
          }
          .restaurant-name {
            font-size: 28pt;
            font-weight: bold;
            color: #7C3AED;
            margin-bottom: 10px;
          }
          .report-title {
            font-size: 20pt;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
          }
          .report-info {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .report-info p {
            margin: 5px 0;
          }
          .summary {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 10pt;
            color: #666;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            font-size: 10pt;
          }
          th {
            background-color: #7C3AED;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="restaurant-name">AGRIVET-CONGO</div>
          <div class="report-title">${reportTitle}</div>
        </div>
        
        <div class="report-info">
          <p><strong>Date de génération:</strong> ${currentDate}</p>
          <p><strong>Période:</strong> ${startDate} - ${endDate}</p>
          <p><strong>Nombre d'éléments:</strong> ${data.length}</p>
        </div>
        
        ${tableHTML}
        
        <div class="summary">
          ${reportType === 'sales' ? `
            <p><strong>Total des ventes USD:</strong> $${data.reduce((sum, item) => sum + (item.subTotalUsd || 0), 0).toFixed(2)}</p>
            <p><strong>Total des ventes CDF:</strong> ${data.reduce((sum, item) => sum + (item.subTotalCdf || 0), 0).toLocaleString()} CDF</p>
            <p><strong>Quantité totale:</strong> ${data.reduce((sum, item) => sum + (item.qte || 0), 0)}</p>
          ` : reportType === 'consumption' ? `
            <p><strong>Total des revenus:</strong> $${data.reduce((sum, item) => sum + (item.totalRevenueUsd || 0), 0).toFixed(2)}</p>
            <p><strong>Total des revenus CDF:</strong> ${data.reduce((sum, item) => sum + (item.totalRevenueCdf || 0), 0).toLocaleString()} CDF</p>
            <p><strong>Quantité totale vendue:</strong> ${data.reduce((sum, item) => sum + (item.totalQuantitySold || 0), 0)}</p>
            <p><strong>Nombre total de ventes:</strong> ${data.reduce((sum, item) => sum + (item.numberOfSales || 0), 0)}</p>
          ` : reportType === 'stock' ? `
            <p><strong>Total des mouvements:</strong> ${data.length}</p>
            <p><strong>Sorties:</strong> ${data.filter(item => item.mouvementType?.toLowerCase() === 'sortie').length}</p>
            <p><strong>Entrées:</strong> ${data.filter(item => item.mouvementType?.toLowerCase() !== 'sortie').length}</p>
            <p><strong>Quantité totale (sorties):</strong> ${data.filter(item => item.mouvementType?.toLowerCase() === 'sortie').reduce((sum, item) => sum + (item.quantity || 0), 0)}</p>
            <p><strong>Quantité totale (entrées):</strong> ${data.filter(item => item.mouvementType?.toLowerCase() !== 'sortie').reduce((sum, item) => sum + (item.quantity || 0), 0)}</p>
          ` : reportType === 'payment' ? `
            <p><strong>Nombre de paiements:</strong> ${data.length}</p>
            <p><strong>Total payé USD:</strong> $${data.reduce((sum, item) => sum + (item.montantPayUsd || 0), 0).toFixed(2)}</p>
            <p><strong>Total payé CDF:</strong> ${data.reduce((sum, item) => sum + (item.montantPayCdf || 0), 0).toLocaleString()} CDF</p>
            <p><strong>Total facture USD:</strong> $${data.reduce((sum, item) => sum + (item.taxationUsd || 0), 0).toFixed(2)}</p>
            <p><strong>Total facture CDF:</strong> ${data.reduce((sum, item) => sum + (item.taxationCdf || 0), 0).toLocaleString()} CDF</p>
          ` : `
            <p><strong>Factures en dette:</strong> ${data.length}</p>
            <p><strong>Crédit total USD:</strong> $${data.reduce((sum, item) => sum + (item.creditUsd || 0), 0).toFixed(2)}</p>
            <p><strong>Crédit total CDF:</strong> ${data.reduce((sum, item) => sum + (item.creditCdf || 0), 0).toLocaleString()} CDF</p>
            <p><strong>Payé total USD:</strong> $${data.reduce((sum, item) => sum + (item.montantPayeUsd || 0), 0).toFixed(2)}</p>
            <p><strong>Payé total CDF:</strong> ${data.reduce((sum, item) => sum + (item.montantPayeCdf || 0), 0).toLocaleString()} CDF</p>
          `}
        </div>
        
        <div class="footer">
          <p>AGRIVET-CONGO - POST-MARKET Manager</p>
          <p>Généré le ${currentDate}</p>
        </div>
      </body>
      </html>
    `;
  };

  // Les fonctions PDF ont été remplacées par l'impression HTML native

  // Génération du calendrier
  const generateCalendar = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Jours du mois précédent (pour remplir la première semaine)
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevMonth = new Date(currentYear, currentMonth, -i);
      days.push({
        day: prevMonth.getDate(),
        month: prevMonth.getMonth(),
        year: prevMonth.getFullYear(),
        isCurrentMonth: false
      });
    }

    // Jours du mois actuel
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        month: currentMonth,
        year: currentYear,
        isCurrentMonth: true
      });
    }

    // Jours du mois suivant (pour remplir la dernière semaine)
    const remainingDays = 42 - days.length; // 6 semaines * 7 jours
    for (let day = 1; day <= remainingDays; day++) {
      const nextMonth = new Date(currentYear, currentMonth + 1, day);
      days.push({
        day: nextMonth.getDate(),
        month: nextMonth.getMonth(),
        year: nextMonth.getFullYear(),
        isCurrentMonth: false
      });
    }

    return days;
  };

  // Générer le calendrier par semaines pour mobile
  const generateCalendarWeeks = () => {
    const days = generateCalendar();
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <View style={styles.containerWeb}>
        <ScrollView style={[styles.containerWeb, { paddingHorizontal: 140 }]}>
          <Text style={styles.titleWeb}>Rapports</Text>

          {/* Navigation des tabs de rapport */}
          <View style={styles.reportTabsContainerWeb}>
            {reportTabsConfig.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.reportTabButtonWeb,
                  selectedReportType === tab.key && styles.reportTabButtonWebActive
                ]}
                onPress={() => setSelectedReportType(tab.key)}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={selectedReportType === tab.key ? '#FFFFFF' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.reportTabButtonTextWeb,
                    selectedReportType === tab.key && styles.reportTabButtonTextWebActive
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Filtre par intervalle de temps */}
          <View style={styles.filtersSectionWeb}>
            <Text style={styles.sectionTitleWeb}>Filtre par période</Text>
            <View style={styles.filterRowWeb}>
              <View style={styles.filterGroupWeb}>
                <Text style={styles.filterLabelWeb}>Date de début</Text>
                <TouchableOpacity
                  style={styles.dateInputWeb}
                  onPress={() => setShowStartDateModal(true)}
                >
                  <Text style={styles.dateTextWeb}>{formatDateForDisplay(startDate)}</Text>
                  <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View style={styles.filterGroupWeb}>
                <Text style={styles.filterLabelWeb}>Date de fin</Text>
                <TouchableOpacity
                  style={styles.dateInputWeb}
                  onPress={() => setShowEndDateModal(true)}
                >
                  <Text style={styles.dateTextWeb}>{formatDateForDisplay(endDate)}</Text>
                  <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {selectedReportType === 'sales' && (
              <View style={styles.depotSelectorContainerWeb}>
                <Text style={styles.filterLabelWeb}>Dépôt</Text>
                {isAdmin ? (
                  depotCodesLoading ? (
                    <Text style={styles.depotHelperText}>Chargement des dépôts...</Text>
                  ) : depotCodesError ? (
                    <Text style={[styles.depotHelperText, styles.depotHelperTextError]}>
                      {depotCodesError}
                    </Text>
                  ) : depotCodes.length === 0 ? (
                    <Text style={styles.depotHelperText}>Aucun dépôt disponible.</Text>
                  ) : (
                    <View style={styles.depotChipsWeb}>
                      {['', ...depotCodes].map((code) => {
                        const isSelected = selectedDepotCode === code;
                        const displayText = code === '' ? 'Tout' : code;
                        return (
                          <TouchableOpacity
                            key={code === '' ? 'all' : code}
                            style={[
                              styles.depotChipWeb,
                              isSelected && styles.depotChipWebActive,
                            ]}
                            onPress={() => setSelectedDepotCode(code)}
                          >
                            <Text
                              style={[
                                styles.depotChipTextWeb,
                                isSelected && styles.depotChipTextWebActive,
                              ]}
                            >
                              {displayText}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )
                ) : (
                  <View style={styles.depotBadgeWeb}>
                    <Ionicons name="business" size={16} color="#4C1D95" />
                    <Text style={styles.depotBadgeTextWeb}>
                      {userDepotCode || 'Aucun dépôt assigné'}
                    </Text>
                  </View>
                )}
              </View>
            )}


            {/* Bouton pour charger les données de stock */}
            {/* Bouton pour charger les données de stock - Masqué */}
            {/* {selectedReportType === 'stock' && (
          <TouchableOpacity 
            style={styles.loadStockButtonWeb}
            onPress={loadStockData}
            disabled={stockLoading}
          >
            <Ionicons 
              name={stockLoading ? "hourglass-outline" : "refresh-outline"} 
              size={20} 
              color="#FFFFFF" 
            />
            <Text style={styles.loadStockButtonTextWeb}>
              {stockLoading ? 'Chargement...' : 'Charger les données de stock'}
            </Text>
          </TouchableOpacity>
        )} */}
          </View>

          {selectedReportType === 'sales' && isLargeScreen && (
            <>
              {/* Statistiques principales */}
              <View style={styles.mainStatsWeb}>
                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="cash" size={24} color="#10B981" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>${sellingReportSummary.totalRevenueUsd.toFixed(2)}</Text>
                    <Text style={styles.statLabelWeb}>Chiffre d'affaires USD</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="cash" size={24} color="#059669" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>{sellingReportSummary.totalRevenueCdf.toLocaleString()}</Text>
                    <Text style={styles.statLabelWeb}>Chiffre d'affaires CDF</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="receipt" size={24} color="#3B82F6" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>{sellingReportSummary.totalTransactions}</Text>
                    <Text style={styles.statLabelWeb}>Transactions</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="cube" size={24} color="#EF4444" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>{sellingReportSummary.totalQuantity}</Text>
                    <Text style={styles.statLabelWeb}>Quantité vendue</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="card" size={24} color="#8B5CF6" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>
                      {intervalMetricsLoading ? '...' : intervalMetrics ? `$${intervalMetrics.totalFactureAmountAfterReductionUsd.toFixed(2)}` : '$0.00'}
                    </Text>
                    <Text style={styles.statLabelWeb}>Montant facture après réduction USD</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="card" size={24} color="#7C3AED" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>
                      {intervalMetricsLoading ? '...' : intervalMetrics ? intervalMetrics.totalFactureAmountAfterReductionCdf.toLocaleString() : '0'}
                    </Text>
                    <Text style={styles.statLabelWeb}>Montant facture après réduction CDF</Text>
                  </View>
                </View>
              </View>

              {/* Filtre par catégorie - Masqué */}
              {/* <View style={{ marginBottom: 20, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>Filtrer par catégorie:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <TouchableOpacity 
              style={[
                { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB' },
                !selectedCategoryId && { backgroundColor: '#10B981', borderColor: '#10B981' }
              ]}
              onPress={() => setSelectedCategoryId(null)}
            >
              <Text style={[
                { fontSize: 14, fontWeight: '500', color: '#6B7280' },
                !selectedCategoryId && { color: '#FFFFFF' }
              ]}>
                Toutes les catégories
              </Text>
            </TouchableOpacity>
            {Array.isArray(categories) && categories.map((category) => (
              <TouchableOpacity 
                key={category.id}
                style={[
                  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB' },
                  selectedCategoryId === category.id && { backgroundColor: '#10B981', borderColor: '#10B981' }
                ]}
                onPress={() => setSelectedCategoryId(category.id)}
              >
                <Text style={[
                  { fontSize: 14, fontWeight: '500', color: '#6B7280' },
                  selectedCategoryId === category.id && { color: '#FFFFFF' }
                ]}>
                  {category.categoryName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View> */}

              {/* Filtre par utilisateur */}
              <View style={{ marginBottom: 20, paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 }}>Filtrer par utilisateur:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <TouchableOpacity
                    style={[
                      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB' },
                      !selectedUserId && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }
                    ]}
                    onPress={() => setSelectedUserId(null)}
                  >
                    <Text style={[
                      { fontSize: 14, fontWeight: '500', color: '#6B7280' },
                      !selectedUserId && { color: '#FFFFFF' }
                    ]}>
                      Tous les utilisateurs
                    </Text>
                  </TouchableOpacity>
                  {users.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB' },
                        selectedUserId === user.id && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }
                      ]}
                      onPress={() => setSelectedUserId(user.id)}
                    >
                      <Text style={[
                        { fontSize: 14, fontWeight: '500', color: '#6B7280' },
                        selectedUserId === user.id && { color: '#FFFFFF' }
                      ]}>
                        {user.username}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Table des ventes ou carte de détails */}
              <View style={styles.tableSectionWeb}>
                {selectedTransaction ? (
                  // Carte de détails de la transaction
                  <View style={styles.transactionDetailsCardWeb}>
                    <View style={styles.transactionDetailsHeaderWeb}>
                      <TouchableOpacity onPress={backToTable} style={styles.backButtonWeb}>
                        <Ionicons name="arrow-back" size={20} color="#6B7280" />
                        <Text style={styles.backButtonTextWeb}>Retour au tableau</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.transactionDetailsContentWeb}>
                      <View style={styles.transactionDetailsRowWeb}>
                        <Text style={styles.transactionDetailsLabelWeb}>Produit</Text>
                        <Text style={styles.transactionDetailsValueWeb}>{selectedTransaction.productName}</Text>
                      </View>

                      <View style={styles.transactionDetailsRowWeb}>
                        <Text style={styles.transactionDetailsLabelWeb}>Client</Text>
                        <Text style={styles.transactionDetailsValueWeb}>{selectedTransaction.factureClient}</Text>
                      </View>

                      <View style={styles.transactionDetailsRowWeb}>
                        <Text style={styles.transactionDetailsLabelWeb}>Table</Text>
                        <Text style={styles.transactionDetailsValueWeb}>{selectedTransaction.tableNomination}</Text>
                      </View>

                      <View style={styles.transactionDetailsRowWeb}>
                        <Text style={styles.transactionDetailsLabelWeb}>Quantité</Text>
                        <Text style={styles.transactionDetailsValueWeb}>{selectedTransaction.qte}</Text>
                      </View>

                      <View style={styles.transactionDetailsRowWeb}>
                        <Text style={styles.transactionDetailsLabelWeb}>Prix USD</Text>
                        <Text style={[styles.transactionDetailsValueWeb, styles.transactionDetailsAmountWeb]}>
                          ${selectedTransaction.subTotalUsd.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.transactionDetailsRowWeb}>
                        <Text style={styles.transactionDetailsLabelWeb}>Prix CDF</Text>
                        <Text style={[styles.transactionDetailsValueWeb, styles.transactionDetailsAmountWeb]}>
                          {selectedTransaction.subTotalCdf.toLocaleString()} CDF
                        </Text>
                      </View>

                      <View style={styles.transactionDetailsRowWeb}>
                        <Text style={styles.transactionDetailsLabelWeb}>Date</Text>
                        <Text style={styles.transactionDetailsValueWeb}>
                          {new Date(selectedTransaction.created).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>

                      <View style={styles.transactionDetailsRowWeb}>
                        <Text style={styles.transactionDetailsLabelWeb}>Responsable</Text>
                        <Text style={styles.transactionDetailsValueWeb}>{selectedTransaction.userName}</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  // Tableau des ventes
                  <>
                    <View style={styles.sectionHeaderWeb}>
                      <Text style={styles.sectionTitleWeb}>Rapport de Vente ({filteredSellingReportData.length})</Text>
                      <TouchableOpacity
                        style={styles.printButtonWeb}
                        onPress={() => handlePrintReport('sales')}
                      >
                        <Ionicons name="print" size={20} color="#FFFFFF" />
                        <Text style={styles.printButtonTextWeb}>Imprimer PDF</Text>
                      </TouchableOpacity>
                    </View>

                    {sellingReportLoading ? (
                      <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="hourglass-outline" size={32} color="#6B7280" />
                        <Text style={{ marginTop: 12, fontSize: 16, color: '#6B7280', fontWeight: '500' }}>
                          Chargement des données...
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.tableWeb}>
                        <View style={styles.tableHeaderWeb}>
                          <Text style={styles.tableHeaderTextWeb}>Produit</Text>
                          <Text style={styles.tableHeaderTextWeb}>Client</Text>
                          <Text style={styles.tableHeaderTextWeb}>Table</Text>
                          <Text style={styles.tableHeaderTextWeb}>Quantité</Text>
                          <Text style={styles.tableHeaderTextWeb}>Prix unitaire USD * Quantité</Text>
                          <Text style={styles.tableHeaderTextWeb}>Prix unitaire CDF * Quantité</Text>
                          <Text style={styles.tableHeaderTextWeb}>Utilisateur</Text>
                          <Text style={styles.tableHeaderTextWeb}>Date</Text>
                        </View>

                        {filteredSellingReportData.map((sale, index) => (
                          <TouchableOpacity
                            key={sale.id}
                            style={styles.tableRowWeb}
                            onPress={() => selectTransaction(sale)}
                          >
                            <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{sale.productName}</Text>
                            <Text style={styles.tableCellWeb}>{sale.factureClient}</Text>
                            <Text style={styles.tableCellWeb}>{sale.tableNomination}</Text>
                            <Text style={styles.tableCellWeb}>{sale.qte}</Text>
                            <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#059669' }]}>
                              {`${sale.subTotalUsd.toFixed(2)} USD`}
                            </Text>
                            <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#059669' }]}>
                              {`${sale.subTotalCdf.toFixed(2)} CDF`}
                            </Text>
                            <Text style={styles.tableCellWeb}>{sale.userName}</Text>
                            <Text style={styles.tableCellWeb}>
                              {new Date(sale.created).toLocaleDateString('fr-FR')} {new Date(sale.created).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}

          {selectedReportType === 'consumption' && isLargeScreen && (
            <>
              {/* Statistiques de consommation */}
              <View style={styles.mainStatsWeb}>
                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="cube" size={24} color="#7C3AED" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>{consumptionReportSummary.totalProducts}</Text>
                    <Text style={styles.statLabelWeb}>Produits</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="cash" size={24} color="#059669" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>{consumptionReportSummary.totalRevenueCdf.toLocaleString()}</Text>
                    <Text style={styles.statLabelWeb}>Revenus CDF</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="trending-down" size={24} color="#EF4444" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>
                      {consumptionReportSummary.totalQuantitySold}
                    </Text>
                    <Text style={styles.statLabelWeb}>Quantité vendue</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="calculator" size={24} color="#F59E0B" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>
                      ${consumptionReportSummary.totalRevenueUsd.toFixed(2)}
                    </Text>
                    <Text style={styles.statLabelWeb}>Revenus USD</Text>
                  </View>
                </View>

                <View style={styles.statCardWeb}>
                  <View style={styles.statIconWeb}>
                    <Ionicons name="receipt" size={24} color="#3B82F6" />
                  </View>
                  <View style={styles.statContentWeb}>
                    <Text style={styles.statValueWeb}>
                      {consumptionReportSummary.totalSales}
                    </Text>
                    <Text style={styles.statLabelWeb}>Nombre de ventes</Text>
                  </View>
                </View>
              </View>

              {/* Table du rapport de consommation */}
              <View style={styles.tableSectionWeb}>
                <View style={styles.sectionHeaderWeb}>
                  <Text style={styles.sectionTitleWeb}>Rapport de Consommation ({consumptionReportData.length})</Text>
                  <TouchableOpacity
                    style={styles.printButtonWeb}
                    onPress={() => handlePrintReport('consumption')}
                  >
                    <Ionicons name="print" size={20} color="#FFFFFF" />
                    <Text style={styles.printButtonTextWeb}>Imprimer PDF</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.tableWeb}>
                  <View style={styles.tableHeaderWeb}>
                    <Text style={styles.tableHeaderTextWeb}>Catégorie</Text>
                    <Text style={styles.tableHeaderTextWeb}>Produit</Text>
                    <Text style={styles.tableHeaderTextWeb}>Prix unitaire CDF</Text>
                    <Text style={styles.tableHeaderTextWeb}>Prix unitaire USD</Text>
                    <Text style={styles.tableHeaderTextWeb}>Quantité vendue</Text>
                    <Text style={styles.tableHeaderTextWeb}>Prix unitaire CDF * Quantité</Text>
                    <Text style={styles.tableHeaderTextWeb}>Prix unitaire USD * Quantité</Text>
                    <Text style={styles.tableHeaderTextWeb}>Nombre de ventes</Text>
                    <Text style={styles.tableHeaderTextWeb}>Période</Text>
                  </View>

                  {consumptionReportData.map((item) => (
                    <View key={item.productId} style={styles.tableRowWeb}>
                      <Text style={styles.tableCellWeb}>{item.categoryName}</Text>
                      <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{item.productName}</Text>
                      <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#059669' }]}>
                        {`${item.totalQuantitySold ? (item.totalRevenueCdf / item.totalQuantitySold).toFixed(2) : '0.00'} CDF`}
                      </Text>
                      <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#0B8F97' }]}>
                        {`${item.totalQuantitySold ? (item.totalRevenueUsd / item.totalQuantitySold).toFixed(2) : '0.00'} USD`}
                      </Text>
                      <Text style={styles.tableCellWeb}>{item.totalQuantitySold}</Text>
                      <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#097B58' }]}>
                        {`${(item.totalRevenueCdf ?? 0).toFixed(2)} CDF`}
                      </Text>
                      <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#0E7490' }]}>
                        {`${(item.totalRevenueUsd ?? 0).toFixed(2)} USD`}
                      </Text>
                      <Text style={styles.tableCellWeb}>{item.numberOfSales}</Text>
                      <Text style={styles.tableCellWeb}>
                        {new Date(item.firstSaleDate).toLocaleDateString('fr-FR')} {new Date(item.firstSaleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.lastSaleDate).toLocaleDateString('fr-FR')} {new Date(item.lastSaleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

            </>
          )}

          {selectedReportType === 'debt' && isLargeScreen && (
            <View style={styles.tableSectionWeb}>
                <View style={styles.sectionHeaderWeb}>
                  <Text style={styles.sectionTitleWeb}>Rapport des dettes ({filteredDebtReportData.length})</Text>
                <TouchableOpacity
                  style={styles.printButtonWeb}
                  onPress={loadDebtReportData}
                  disabled={debtReportLoading}
                >
                  <Ionicons name={debtReportLoading ? "hourglass-outline" : "refresh-outline"} size={20} color="#FFFFFF" />
                  <Text style={styles.printButtonTextWeb}>{debtReportLoading ? 'Chargement...' : 'Actualiser'}</Text>
                </TouchableOpacity>
              </View>

              {debtReportError && (
                <View style={styles.errorContainerWeb}>
                  <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                  <Text style={styles.errorTextWeb}>{debtReportError}</Text>
                  <TouchableOpacity style={styles.retryButtonWeb} onPress={loadDebtReportData}>
                    <Text style={styles.retryButtonTextWeb}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              )}

              {debtReportLoading ? (
                <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="hourglass-outline" size={32} color="#6B7280" />
                  <Text style={{ marginTop: 12, fontSize: 16, color: '#6B7280', fontWeight: '500' }}>
                    Chargement des données...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={[styles.stockSearchContainerWeb, { marginBottom: 2 }]}>
                    <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIconWeb} />
                    <TextInput
                      style={[styles.stockSearchInputWeb, { flex: 1 }]}
                      placeholder="Rechercher par code facture ou client..."
                      value={debtSearch}
                      onChangeText={setDebtSearch}
                      placeholderTextColor="#9CA3AF"
                    />
                    {debtSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setDebtSearch('')} style={styles.searchClearButtonWeb}>
                        <Ionicons name="close-circle" size={20} color="#6B7280" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.printButtonWeb, { marginLeft: 8, paddingHorizontal: 12, paddingVertical: 10 }]}
                      onPress={() => handlePrintReport('debt')}
                      disabled={debtReportLoading || filteredDebtReportData.length === 0}
                    >
                      <Ionicons name="print" size={18} color="#FFFFFF" />
                      <Text style={styles.printButtonTextWeb}>Imprimer</Text>
                    </TouchableOpacity>
                  </View>

                  {filteredDebtReportData.length === 0 ? (
                    <View style={styles.emptyStateWeb}>
                      <Ionicons name="document-outline" size={48} color="#9CA3AF" />
                      <Text style={styles.emptyStateTextWeb}>Aucune facture en dette trouvée</Text>
                    </View>
                  ) : (
                    <View style={styles.tableWeb}>
                      <View style={styles.tableHeaderWeb}>
                        <Text style={styles.tableHeaderTextWeb}>Code</Text>
                        <Text style={styles.tableHeaderTextWeb}>Client</Text>
                        <Text style={styles.tableHeaderTextWeb}>Utilisateur</Text>
                        <Text style={styles.tableHeaderTextWeb}>Dépôt</Text>
                        <Text style={styles.tableHeaderTextWeb}>Ventes</Text>
                        <Text style={styles.tableHeaderTextWeb}>Quantité</Text>
                        <Text style={styles.tableHeaderTextWeb}>Crédit USD</Text>
                        <Text style={[styles.tableHeaderTextWeb, { borderRightWidth: 0 }]}>Date</Text>
                      </View>

                      {filteredDebtReportData.map((item) => (
                        <View key={item.id}>
                          <TouchableOpacity style={styles.tableRowWeb} onPress={() => handleOpenDebtModal(item)}>
                            <Text style={styles.tableCellWeb}>{item.numCode || '-'}</Text>
                            <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{item.client || 'Anonyme'}</Text>
                            <Text style={styles.tableCellWeb}>{item.userName}</Text>
                            <Text style={styles.tableCellWeb}>{item.depotCode}</Text>
                            <Text style={styles.tableCellWeb}>{item.nbVentes}</Text>
                            <Text style={styles.tableCellWeb}>{item.qteVentes}</Text>
                            <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#EF4444' }]}>
                              ${item.creditUsd.toFixed(2)} / {item.creditCdf.toLocaleString()} CDF
                            </Text>
                            <Text style={[styles.tableCellWeb, { borderRightWidth: 0 }]}>
                              {formatDate(item.created)}
                            </Text>
                          </TouchableOpacity>
                          <View style={[styles.tableRowWeb, { backgroundColor: '#F9FAFB' }]}>
                            <Text style={[styles.tableCellWeb, { flex: 1, textAlign: 'left' }]}>
                              Total facture:{'\n'}
                              ${item.taxationUsd.toFixed(2)} / {item.taxationCdf.toLocaleString()} CDF
                            </Text>
                            <Text style={[styles.tableCellWeb, { flex: 1, textAlign: 'left' }]}>
                              Payé:{'\n'}
                              ${item.montantPayeUsd.toFixed(2)} / {item.montantPayeCdf.toLocaleString()} CDF
                            </Text>
                            <Text style={[styles.tableCellWeb, { flex: 1, textAlign: 'left', borderRightWidth: 0 }]}>
                              Réduction:{'\n'}
                              ${item.reductionUsd.toFixed(2)} / {item.reductionCdf.toLocaleString()} CDF
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {selectedReportType === 'payment' && isLargeScreen && (
            <View style={styles.tableSectionWeb}>
              <View style={styles.sectionHeaderWeb}>
                <Text style={styles.sectionTitleWeb}>Rapport paiements facture ({filteredPaymentReportData.length})</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={styles.printButtonWeb}
                    onPress={loadPaymentReportData}
                    disabled={paymentReportLoading}
                  >
                    <Ionicons name={paymentReportLoading ? 'hourglass-outline' : 'refresh-outline'} size={20} color="#FFFFFF" />
                    <Text style={styles.printButtonTextWeb}>{paymentReportLoading ? 'Chargement...' : 'Actualiser'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.printButtonWeb}
                    onPress={() => handlePrintReport('payment')}
                    disabled={paymentReportLoading || filteredPaymentReportData.length === 0}
                  >
                    <Ionicons name="print" size={20} color="#FFFFFF" />
                    <Text style={styles.printButtonTextWeb}>Imprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {paymentReportError && (
                <View style={styles.errorContainerWeb}>
                  <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                  <Text style={styles.errorTextWeb}>{paymentReportError}</Text>
                  <TouchableOpacity style={styles.retryButtonWeb} onPress={loadPaymentReportData}>
                    <Text style={styles.retryButtonTextWeb}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={[styles.stockSearchContainerWeb, { marginBottom: 12 }]}>
                <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIconWeb} />
                <TextInput
                  style={[styles.stockSearchInputWeb, { flex: 1 }]}
                  placeholder="Rechercher par facture, client, utilisateur ou dépôt..."
                  value={paymentSearch}
                  onChangeText={setPaymentSearch}
                  placeholderTextColor="#9CA3AF"
                />
                {paymentSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setPaymentSearch('')} style={styles.searchClearButtonWeb}>
                    <Ionicons name="close-circle" size={20} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </View>

              {paymentReportLoading ? (
                <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="hourglass-outline" size={32} color="#6B7280" />
                  <Text style={{ marginTop: 12, fontSize: 16, color: '#6B7280', fontWeight: '500' }}>
                    Chargement des données...
                  </Text>
                </View>
              ) : filteredPaymentReportData.length === 0 ? (
                <View style={styles.emptyStateWeb}>
                  <Ionicons name="document-outline" size={48} color="#9CA3AF" />
                  <Text style={styles.emptyStateTextWeb}>Aucun paiement trouvé</Text>
                </View>
              ) : (
                <View style={styles.tableWeb}>
                  <View style={styles.tableHeaderWeb}>
                    <Text style={styles.tableHeaderTextWeb}>Facture</Text>
                    <Text style={styles.tableHeaderTextWeb}>Client</Text>
                    <Text style={styles.tableHeaderTextWeb}>Utilisateur</Text>
                    <Text style={styles.tableHeaderTextWeb}>Dépôt</Text>
                    <Text style={styles.tableHeaderTextWeb}>Type</Text>
                    <Text style={styles.tableHeaderTextWeb}>Payé USD / CDF</Text>
                    <Text style={styles.tableHeaderTextWeb}>Facture USD / CDF</Text>
                    <Text style={[styles.tableHeaderTextWeb, { borderRightWidth: 0 }]}>Date paiement</Text>
                  </View>
                  {filteredPaymentReportData.map(item => (
                    <View key={item.id} style={styles.tableRowWeb}>
                      <Text style={styles.tableCellWeb}>{item.numFacture || '-'}</Text>
                      <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{item.client || 'Anonyme'}</Text>
                      <Text style={styles.tableCellWeb}>{item.userName}</Text>
                      <Text style={styles.tableCellWeb}>{item.depotCode}</Text>
                      <Text style={styles.tableCellWeb}>{item.typePaiement}{item.remboursement ? ' (R)' : ''}</Text>
                      <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#059669' }]}>
                        ${item.montantPayUsd.toFixed(2)} / {item.montantPayCdf.toLocaleString()} CDF
                      </Text>
                      <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#3B82F6' }]}>
                        ${item.taxationUsd.toFixed(2)} / {item.taxationCdf.toLocaleString()} CDF
                      </Text>
                      <Text style={[styles.tableCellWeb, { borderRightWidth: 0 }]}>
                        {new Date(item.datePaiement).toLocaleDateString('fr-FR')} {new Date(item.datePaiement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {selectedReportType === 'stock' && isLargeScreen && (
            <>
              {/* Section Rapport des stocks */}
              <View style={styles.stockReportSectionWeb}>
                <View style={[styles.sectionHeaderWeb, { marginBottom: 12 }]}>
                  <Text style={[styles.sectionTitleWeb, { visibility: 'hidden' }]}>Rapport des stocks{stockMovementData.length}</Text>
                  <TouchableOpacity
                    style={styles.printButtonWeb}
                    onPress={loadStockData}
                    disabled={stockLoading}
                  >
                    <Ionicons name={stockLoading ? "hourglass-outline" : "refresh-outline"} size={20} color="#FFFFFF" />
                    <Text style={styles.printButtonTextWeb}>{stockLoading ? 'Chargement...' : 'Actualiser'}</Text>
                  </TouchableOpacity>
                </View>

                {/* États de chargement et erreurs */}
                {stockLoading && (
                  <View style={styles.loadingContainerWeb}>
                    <Ionicons name="hourglass-outline" size={48} color="#3B82F6" />
                    <Text style={styles.loadingTextWeb}>Chargement des données de stock...</Text>
                  </View>
                )}

                {stockError && (
                  <View style={styles.errorContainerWeb}>
                    <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                    <Text style={styles.errorTextWeb}>{stockError}</Text>
                    <TouchableOpacity
                      style={styles.retryButtonWeb}
                      onPress={loadStockData}
                    >
                      <Text style={styles.retryButtonTextWeb}>Réessayer</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {setStockMovementData.length > 0 && (
                  <>
                    {/* Section Réapprovisionnement */}
                    {stockReaprovisionData.length > 0 && (
                      <View style={styles.stockSectionWeb}>
                        <Text style={styles.subsectionTitleWeb}>
                          <Ionicons name="trending-up" size={20} color="#10B981" />
                          Réapprovisionnements
                        </Text>
                        <View style={styles.tableContainerWeb}>
                          <View style={styles.tableHeaderWeb}>
                            <Text style={styles.tableHeaderTextWeb}>Date</Text>
                            <Text style={styles.tableHeaderTextWeb}>Produit</Text>
                            <Text style={styles.tableHeaderTextWeb}>Quantité</Text>
                            <Text style={styles.tableHeaderTextWeb}>Observation</Text>
                          </View>
                          {stockReaprovisionData.map((item, index) => (
                            <View key={index} style={styles.tableRowWeb}>
                              <Text style={styles.tableCellWeb}>{formatDate(item.date)}</Text>
                              <Text style={styles.tableCellWeb}>{item.productName}</Text>
                              <Text style={[styles.tableCellWeb, { color: '#10B981', fontWeight: '600' }]}>
                                +{item.quantity}
                              </Text>
                              <Text style={styles.tableCellWeb}>{item.observation || '-'}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Section Sorties de stock */}
                    {stockSortieData.length > 0 && (
                      <View style={styles.stockSectionWeb}>
                        <Text style={styles.subsectionTitleWeb}>
                          <Ionicons name="trending-down" size={20} color="#EF4444" />
                          Sorties de stock
                        </Text>
                        <View style={styles.tableContainerWeb}>
                          <View style={styles.tableHeaderWeb}>
                            <Text style={styles.tableHeaderTextWeb}>Date</Text>
                            <Text style={styles.tableHeaderTextWeb}>Produit</Text>
                            <Text style={styles.tableHeaderTextWeb}>Quantité</Text>
                            <Text style={styles.tableHeaderTextWeb}>Observation</Text>
                          </View>
                          {stockSortieData.map((item, index) => (
                            <View key={index} style={styles.tableRowWeb}>
                              <Text style={styles.tableCellWeb}>{formatDate(item.date)}</Text>
                              <Text style={styles.tableCellWeb}>{item.productName}</Text>
                              <Text style={[styles.tableCellWeb, { color: '#EF4444', fontWeight: '600' }]}>
                                -{item.quantity}
                              </Text>
                              <Text style={styles.tableCellWeb}>{item.observation || '-'}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Section Mouvements de stock */}
                    {stockMovementData.length > 0 && (
                      <View style={styles.stockSectionWeb}>
                        <View style={styles.sectionHeaderWeb}>
                          <Text style={styles.subsectionTitleWeb}>
                            <Ionicons name="swap-vertical" size={20} color="#3B82F6" />
                            Mouvements de stock ({filteredStockMovementData.length})
                          </Text>
                          <TouchableOpacity
                            style={styles.printButtonWeb}
                            onPress={() => handlePrintReport('stock')}
                          >
                            <Ionicons name="print" size={20} color="#FFFFFF" />
                            <Text style={styles.printButtonTextWeb}>Imprimer PDF</Text>
                          </TouchableOpacity>
                        </View>
                        
                        {/* Filtres et recherche */}
                        <View style={styles.stockFiltersContainerWeb}>
                          <View style={styles.stockFilterRowWeb}>
                            <Text style={styles.filterLabelWeb}>Type de mouvement:</Text>
                            <View style={styles.stockFilterChipsWeb}>
                              <TouchableOpacity
                                style={[
                                  styles.stockFilterChipWeb,
                                  stockMovementFilter === 'all' && styles.stockFilterChipWebActive
                                ]}
                                onPress={() => setStockMovementFilter('all')}
                              >
                                <Text style={[
                                  styles.stockFilterChipTextWeb,
                                  stockMovementFilter === 'all' && styles.stockFilterChipTextWebActive
                                ]}>
                                  Tous
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.stockFilterChipWeb,
                                  stockMovementFilter === 'sortie' && styles.stockFilterChipWebActive
                                ]}
                                onPress={() => setStockMovementFilter('sortie')}
                              >
                                <Text style={[
                                  styles.stockFilterChipTextWeb,
                                  stockMovementFilter === 'sortie' && styles.stockFilterChipTextWebActive
                                ]}>
                                  Sortie
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.stockFilterChipWeb,
                                  stockMovementFilter === 'entree' && styles.stockFilterChipWebActive
                                ]}
                                onPress={() => setStockMovementFilter('entree')}
                              >
                                <Text style={[
                                  styles.stockFilterChipTextWeb,
                                  stockMovementFilter === 'entree' && styles.stockFilterChipTextWebActive
                                ]}>
                                  Entrée
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          <View style={styles.stockSearchContainerWeb}>
                            <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIconWeb} />
                            <TextInput
                              style={styles.stockSearchInputWeb}
                              placeholder="Rechercher par nom de produit..."
                              value={stockMovementSearch}
                              onChangeText={setStockMovementSearch}
                              placeholderTextColor="#9CA3AF"
                            />
                            {stockMovementSearch.length > 0 && (
                              <TouchableOpacity
                                onPress={() => setStockMovementSearch('')}
                                style={styles.searchClearButtonWeb}
                              >
                                <Ionicons name="close-circle" size={20} color="#6B7280" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        
                        <View style={styles.tableContainerWeb}>
                          <View style={styles.tableHeaderWeb}>
                            <Text style={styles.tableHeaderTextWeb}>Date</Text>
                            <Text style={styles.tableHeaderTextWeb}>Produit</Text>
                            <Text style={styles.tableHeaderTextWeb}>Mouvement</Text>
                            <Text style={styles.tableHeaderTextWeb}>Type</Text>
                            <Text style={styles.tableHeaderTextWeb}>Quantité</Text>
                            <Text style={styles.tableHeaderTextWeb}>Utilisateur</Text>
                            <Text style={styles.tableHeaderTextWeb}>Dépôt</Text>
                            <Text style={[styles.tableHeaderTextWeb, { borderRightWidth: 0 }]}>Expiration</Text>
                          </View>
                          {filteredStockMovementData.map((item, index) => {
                            const isSortie = item.mouvementType?.toLowerCase() === 'sortie';
                            const rowStyle = {
                              backgroundColor: '#FFFFFF'
                            };
                            const quantityPrefix = isSortie ? '-' : '+';
                            return (
                              <View key={index} style={[styles.tableRowWeb, rowStyle]}>
                                <View style={styles.tableCellWeb}>
                                  <Text style={styles.tableCellTextWeb}>
                                    {new Date(item.transactionDate).toLocaleDateString('fr-FR')} {new Date(item.transactionDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                </View>
                                <View style={[styles.tableCellWeb, styles.descriptionCellWeb]}>
                                  <Text style={styles.tableCellTextWeb}>{item.productName}</Text>
                                </View>
                                <View style={styles.tableCellWeb}>
                                  <Text style={styles.tableCellTextWeb}>{item.mouvementType}</Text>
                                </View>
                                <View style={styles.tableCellWeb}>
                                  <Text style={styles.tableCellTextWeb}>{item.transactionType}</Text>
                                </View>
                                <View style={[styles.tableCellWeb, { justifyContent: 'center', alignItems: 'center' }]}>
                                  <View style={[
                                    styles.quantityBadgeWeb,
                                    { backgroundColor: isSortie ? '#FEE2E2' : '#D1FAE5' }
                                  ]}>
                                    <Text style={[
                                      styles.quantityBadgeTextWeb,
                                      { color: isSortie ? '#DC2626' : '#059669' }
                                    ]}>
                                      {quantityPrefix}{item.quantity}
                                    </Text>
                                  </View>
                                </View>
                                <View style={styles.tableCellWeb}>
                                  <Text style={styles.tableCellTextWeb}>{item.userName}</Text>
                                </View>
                                <View style={styles.tableCellWeb}>
                                  <Text style={styles.tableCellTextWeb}>{item.depotCode}</Text>
                                </View>
                                <View style={[styles.tableCellWeb, { borderRightWidth: 0 }]}>
                                  <Text style={styles.tableCellTextWeb}>
                                    {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('fr-FR') : '-'}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </>
                )}

                {stockMovementData.length === 0 || stockError && (
                  <View style={styles.emptyStateWeb}>
                    <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyStateTextWeb}>Aucune donnée de stock trouvée</Text>
                    <Text style={styles.emptyStateSubtextWeb}>Cliquez sur "Charger les données de stock" pour commencer</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Modals de calendrier pour web */}
        <CalendarModal
          visible={showStartDateModal}
          onClose={() => setShowStartDateModal(false)}
          selectedDate={startDate}
          onDateSelect={handleStartDateSelect}
          title="Sélectionner la date de début"
        />
        <CalendarModal
          visible={showEndDateModal}
          onClose={() => setShowEndDateModal(false)}
          selectedDate={endDate}
          onDateSelect={handleEndDateSelect}
          title="Sélectionner la date de fin"
        />
        {showPdfOverlay && (
          <Modal
            visible={showPdfOverlay}
            transparent
            animationType="fade"
            onRequestClose={closePdfPreview}
          >
            <View style={styles.pdfOverlayBackdrop}>
              <View style={styles.pdfOverlayContainer}>
                <View style={styles.pdfOverlayHeader}>
                  <Text style={styles.pdfOverlayTitle}>{pdfTitle || 'Aperçu du rapport'}</Text>
                  <View style={styles.pdfOverlayActions}>
                    {Platform.OS === 'web' && pdfPreviewHtml !== '' && (
                      <TouchableOpacity style={styles.pdfOverlayButton} onPress={handlePrintFromPreview}>
                        <Ionicons name="print" size={18} color="#FFFFFF" />
                        <Text style={styles.pdfOverlayButtonText}>Imprimer</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.pdfOverlayCloseButton} onPress={closePdfPreview}>
                      <Ionicons name="close" size={22} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.pdfOverlayBody}>
                  {Platform.OS === 'web' ? (
                    <View style={styles.pdfIframeContainer}>
                      {pdfPreviewHtml ? (
                        React.createElement('iframe', {
                          srcDoc: pdfPreviewHtml,
                          style: {
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            borderRadius: '12px'
                          },
                          ref: iframeRef
                        } as any)
                      ) : (
                        <View style={styles.pdfOverlayEmptyState}>
                          <Ionicons name="document-outline" size={32} color="#9CA3AF" />
                          <Text style={styles.pdfOverlayEmptyText}>Aucune prévisualisation disponible.</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <ScrollView style={styles.pdfOverlayScroll} contentContainerStyle={styles.pdfOverlayScrollContent}>
                      <Text style={styles.pdfOverlaySectionTitle}>Résumé</Text>
                      {(() => {
                        const reportText = generateReportText();
                        if (!reportText) {
                          return (
                            <Text style={styles.pdfOverlayText}>Aucune donnée disponible pour ce rapport.</Text>
                          );
                        }
                        return reportText.split('\n').map((line, index) => (
                          <Text key={index} style={styles.pdfOverlayText}>
                            {line}
                          </Text>
                        ));
                      })()}
                    </ScrollView>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        )}
        {showDebtModal && selectedDebt && (
          <Modal
            visible={showDebtModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDebtModal(false)}
          >
            <View style={styles.pdfOverlayBackdrop}>
              <View style={[styles.pdfOverlayContainer, { maxWidth: 900 }]}>
                <View style={styles.pdfOverlayHeader}>
                  <Text style={styles.pdfOverlayTitle}>Paiements facture {selectedDebt.numCode || ''}</Text>
                  <View style={styles.pdfOverlayActions}>
                    <TouchableOpacity style={styles.pdfOverlayCloseButton} onPress={() => setShowDebtModal(false)}>
                      <Ionicons name="close" size={22} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[
                      styles.reportTabButtonWeb,
                      debtPaymentTab === 'list' && styles.reportTabButtonWebActive
                    ]}
                    onPress={() => setDebtPaymentTab('list')}
                  >
                    <Ionicons name="list" size={18} color={debtPaymentTab === 'list' ? '#FFFFFF' : '#6B7280'} />
                    <Text style={[
                      styles.reportTabButtonTextWeb,
                      debtPaymentTab === 'list' && styles.reportTabButtonTextWebActive
                    ]}>Paiements</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reportTabButtonWeb,
                      debtPaymentTab === 'pay' && styles.reportTabButtonWebActive
                    ]}
                    onPress={() => setDebtPaymentTab('pay')}
                  >
                    <Ionicons name="card" size={18} color={debtPaymentTab === 'pay' ? '#FFFFFF' : '#6B7280'} />
                    <Text style={[
                      styles.reportTabButtonTextWeb,
                      debtPaymentTab === 'pay' && styles.reportTabButtonTextWebActive
                    ]}>Effectuer un paiement</Text>
                  </TouchableOpacity>
                </View>

                {debtPaymentTab === 'list' ? (
                  <View style={{ flex: 1 }}>
                    {debtPaymentsLoading ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Ionicons name="hourglass-outline" size={28} color="#6B7280" />
                        <Text style={{ marginTop: 8, color: '#6B7280', fontWeight: '500' }}>Chargement...</Text>
                      </View>
                    ) : debtPaymentsError ? (
                      <View style={styles.errorContainerWeb}>
                        <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                        <Text style={styles.errorTextWeb}>{debtPaymentsError}</Text>
                        <TouchableOpacity style={styles.retryButtonWeb} onPress={() => loadDebtPayments(selectedDebt.id)}>
                          <Text style={styles.retryButtonTextWeb}>Réessayer</Text>
                        </TouchableOpacity>
                      </View>
                    ) : debtPayments.length === 0 ? (
                      <View style={styles.emptyStateWeb}>
                        <Ionicons name="document-outline" size={32} color="#9CA3AF" />
                        <Text style={styles.emptyStateTextWeb}>Aucun paiement trouvé</Text>
                      </View>
                    ) : (
                      <View style={styles.tableWeb}>
                        <View style={styles.tableHeaderWeb}>
                          <Text style={styles.tableHeaderTextWeb}>Montant</Text>
                          <Text style={styles.tableHeaderTextWeb}>Taux</Text>
                          <Text style={styles.tableHeaderTextWeb}>Observation</Text>
                          <Text style={[styles.tableHeaderTextWeb, { borderRightWidth: 0 }]}>Date</Text>
                        </View>
                        {debtPayments.map((p: any) => (
                          <View key={p.id} style={styles.tableRowWeb}>
                            <Text style={styles.tableCellWeb}>
                              ${(p.amountUsd ?? p.amount ?? 0).toFixed ? (p.amountUsd ?? p.amount ?? 0).toFixed(2) : (p.amountUsd ?? p.amount ?? 0)} / {(p.amountCdf ?? 0).toLocaleString()} CDF
                            </Text>
                            <Text style={styles.tableCellWeb}>{p.taux ?? '-'}</Text>
                            <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{p.observation || '-'}</Text>
                            <Text style={[styles.tableCellWeb, { borderRightWidth: 0 }]}>{formatDate(p.created)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity
                        style={[
                          styles.depotChipWeb,
                          paymentDevise === 1 && styles.depotChipWebActive
                        ]}
                        onPress={() => setPaymentDevise(1)}
                      >
                        <Text style={[
                          styles.depotChipTextWeb,
                          paymentDevise === 1 && styles.depotChipTextWebActive
                        ]}>USD</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.depotChipWeb,
                          paymentDevise === 2 && styles.depotChipWebActive
                        ]}
                        onPress={() => setPaymentDevise(2)}
                      >
                        <Text style={[
                          styles.depotChipTextWeb,
                          paymentDevise === 2 && styles.depotChipTextWebActive
                        ]}>CDF</Text>
                      </TouchableOpacity>
                    </View>
                    <View>
                      <Text style={styles.filterLabelWeb}>Montant (reste {paymentDevise === 1 ? `${selectedDebt.creditUsd.toFixed(2)} USD` : `${selectedDebt.creditCdf.toLocaleString()} CDF`})</Text>
                      <TextInput
                        style={[styles.dateInputWeb, { textAlign: 'left' }]}
                        keyboardType="numeric"
                        placeholder="0"
                        value={paymentAmount}
                        onChangeText={(val) => {
                          let next = val;
                          const parsed = parseFloat(val);
                          const max = paymentDevise === 1 ? selectedDebt.creditUsd : selectedDebt.creditCdf;
                          if (!isNaN(parsed) && parsed > max) {
                            next = max.toString();
                          }
                          if (!isNaN(parsed) && parsed < 0) {
                            next = '0';
                          }
                          setPaymentAmount(next);
                        }}
                      />
                    </View>
                    <View>
                      <Text style={styles.filterLabelWeb}>Observation</Text>
                      <TextInput
                        style={[styles.dateInputWeb, { textAlign: 'left' }]}
                        placeholder="Note"
                        value={paymentObservation}
                        onChangeText={setPaymentObservation}
                      />
                    </View>
                    {paymentError && (
                      <Text style={{ color: '#EF4444', fontSize: 13 }}>{paymentError}</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.printButtonWeb, { backgroundColor: paymentSubmitting ? '#A78BFA' : '#7C3AED' }]}
                      onPress={handleSubmitDebtPayment}
                      disabled={paymentSubmitting}
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.printButtonTextWeb}>{paymentSubmitting ? 'Envoi...' : 'Valider le paiement'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }

  // Version Mobile/Table
  if (!isLargeScreen) {
    return (
      <ScrollView style={styles.containerMobile}>
        <Text style={styles.titleMobile}>Rapports</Text>

        {/* Navigation des tabs de rapport - Modern Design */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reportTabsScrollMobile}
        >
          <View style={styles.reportTabsContainerMobile}>
            {reportTabsConfig.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.reportTabButtonMobile,
                  selectedReportType === tab.key && styles.reportTabButtonMobileActive
                ]}
                onPress={() => {
                  setSelectedReportType(tab.key);
                  setSelectedTransaction(null);
                }}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={selectedReportType === tab.key ? '#FFFFFF' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.reportTabButtonTextMobile,
                    selectedReportType === tab.key && styles.reportTabButtonTextMobileActive
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Filtre par intervalle de temps - Grid Horizontal */}
        <View style={styles.filtersSectionModernMobile}>
          <Text style={styles.sectionTitleMobile}>Période</Text>
          <View style={styles.dateGridMobile}>
            <TouchableOpacity
              style={styles.dateCardMobile}
              onPress={() => setShowMobileStartDateModal(true)}
            >
              <Ionicons name="calendar" size={20} color="#7C3AED" />
              <Text style={styles.dateLabelMobile}>Début</Text>
              <Text style={styles.dateValueMobile}>{formatDateForDisplay(startDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateCardMobile}
              onPress={() => setShowMobileEndDateModal(true)}
            >
              <Ionicons name="calendar" size={20} color="#7C3AED" />
              <Text style={styles.dateLabelMobile}>Fin</Text>
              <Text style={styles.dateValueMobile}>{formatDateForDisplay(endDate)}</Text>
            </TouchableOpacity>
          </View>

          {/* Bouton pour charger les données de stock */}
          {selectedReportType === 'stock' && (
            <TouchableOpacity
              style={styles.loadStockButtonMobile}
              onPress={loadStockData}
              disabled={stockLoading}
            >
              <Ionicons
                name={stockLoading ? "hourglass-outline" : "refresh-outline"}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.loadStockButtonTextMobile}>
                {stockLoading ? 'Chargement...' : 'Charger les données de stock'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {selectedReportType === 'sales' && (
          <View style={styles.depotSelectorContainerMobile}>
            <Text style={styles.sectionTitleMobile}>Dépôt</Text>
            {isAdmin ? (
              depotCodesLoading ? (
                <Text style={styles.depotHelperTextMobile}>Chargement des dépôts...</Text>
              ) : depotCodesError ? (
                <Text style={[styles.depotHelperTextMobile, styles.depotHelperTextError]}>
                  {depotCodesError}
                </Text>
              ) : depotCodes.length === 0 ? (
                <Text style={styles.depotHelperTextMobile}>Aucun dépôt disponible.</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.depotChipsScrollMobile}
                >
                  <TouchableOpacity
                    style={[
                      styles.depotChipMobile,
                      selectedDepotCode === '' && styles.depotChipMobileActive,
                    ]}
                    onPress={() => setSelectedDepotCode('')}
                  >
                    <Text
                      style={[
                        styles.depotChipTextMobile,
                        selectedDepotCode === '' && styles.depotChipTextMobileActive,
                      ]}
                    >
                      Tout
                    </Text>
                  </TouchableOpacity>
                  {depotCodes.map((code) => {
                    const isSelected = selectedDepotCode === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[
                          styles.depotChipMobile,
                          isSelected && styles.depotChipMobileActive,
                        ]}
                        onPress={() => setSelectedDepotCode(code)}
                      >
                        <Text
                          style={[
                            styles.depotChipTextMobile,
                            isSelected && styles.depotChipTextMobileActive,
                          ]}
                        >
                          {code}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )
            ) : (
              <View style={styles.depotBadgeMobile}>
                <Ionicons name="business" size={16} color="#4C1D95" />
                <Text style={styles.depotBadgeTextMobile}>
                  {userDepotCode || 'Aucun dépôt assigné'}
                </Text>
              </View>
            )}
          </View>
        )}

        {selectedReportType === 'sales' && (
          <>
            {/* Statistiques principales - Grid 2x2 */}
            <View style={styles.statsGridMobile}>
              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="cash" size={24} color="#10B981" />
                </View>
                <Text style={styles.statValueModernMobile}>${sellingReportSummary.totalRevenueUsd.toFixed(2)}</Text>
                <Text style={styles.statLabelModernMobile}>Chiffre d'affaires USD</Text>
              </View>

              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="cash" size={24} color="#059669" />
                </View>
                <Text style={styles.statValueModernMobile}>{sellingReportSummary.totalRevenueCdf.toLocaleString()}</Text>
                <Text style={styles.statLabelModernMobile}>Chiffre d'affaires CDF</Text>
              </View>

              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="receipt" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.statValueModernMobile}>{sellingReportSummary.totalTransactions}</Text>
                <Text style={styles.statLabelModernMobile}>Transactions</Text>
              </View>

              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="cube" size={24} color="#EF4444" />
                </View>
                <Text style={styles.statValueModernMobile}>{sellingReportSummary.totalQuantity}</Text>
                <Text style={styles.statLabelModernMobile}>Quantité vendue</Text>
              </View>

              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="card" size={24} color="#8B5CF6" />
                </View>
                <Text style={styles.statValueModernMobile}>
                  {intervalMetricsLoading ? '...' : intervalMetrics ? `$${intervalMetrics.totalFactureAmountAfterReductionUsd.toFixed(2)}` : '$0.00'}
                </Text>
                <Text style={styles.statLabelModernMobile}>Montant facture après réduction USD</Text>
              </View>

              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="card" size={24} color="#7C3AED" />
                </View>
                <Text style={styles.statValueModernMobile}>
                  {intervalMetricsLoading ? '...' : intervalMetrics ? intervalMetrics.totalFactureAmountAfterReductionCdf.toLocaleString() : '0'}
                </Text>
                <Text style={styles.statLabelModernMobile}>Montant facture après réduction CDF</Text>
              </View>
            </View>

            {/* Filtre par utilisateur - Mobile */}
            <View style={{ marginBottom: 16, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>Filtrer par utilisateur:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  style={[
                    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', marginRight: 8 },
                    !selectedUserId && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }
                  ]}
                  onPress={() => setSelectedUserId(null)}
                >
                  <Text style={[
                    { fontSize: 12, fontWeight: '500', color: '#6B7280' },
                    !selectedUserId && { color: '#FFFFFF' }
                  ]}>
                    Tous
                  </Text>
                </TouchableOpacity>
                {users.map((user) => (
                  <TouchableOpacity
                    key={user.id}
                    style={[
                      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', marginRight: 8 },
                      selectedUserId === user.id && { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }
                    ]}
                    onPress={() => setSelectedUserId(user.id)}
                  >
                    <Text style={[
                      { fontSize: 12, fontWeight: '500', color: '#6B7280' },
                      selectedUserId === user.id && { color: '#FFFFFF' }
                    ]}>
                      {user.username}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Liste des ventes ou Détails */}
            {!selectedTransaction ? (
              <View style={styles.listSectionMobile}>
                <View style={styles.sectionHeaderMobile}>
                  <Text style={styles.sectionTitleMobile}>Rapport de Vente ({filteredSellingReportData.length})</Text>
                  <TouchableOpacity
                    style={styles.printButtonMobile}
                    onPress={() => handlePrintReport('sales')}
                  >
                    <Ionicons name="print" size={16} color="#FFFFFF" />
                    <Text style={styles.printButtonTextMobile}>PDF</Text>
                  </TouchableOpacity>
                </View>

                {sellingReportLoading ? (
                  <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="hourglass-outline" size={28} color="#6B7280" />
                    <Text style={{ marginTop: 12, fontSize: 14, color: '#6B7280', fontWeight: '500' }}>
                      Chargement des données...
                    </Text>
                  </View>
                ) : (
                  <View style={styles.transactionsListMobile}>
                    {filteredSellingReportData.map((sale, index) => (
                      <TouchableOpacity key={sale.id} style={styles.transactionItemMobile} onPress={() => selectTransaction(sale)}>
                        <View style={styles.transactionHeaderMobile}>
                          <View style={styles.productInfoMobile}>
                            <Text style={styles.transactionDescriptionMobile}>{sale.productName}</Text>
                            <Text style={styles.transactionDateTextMobile}>
                              {new Date(sale.created).toLocaleDateString('fr-FR')} {new Date(sale.created).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>

                        <View style={{ marginVertical: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Client:</Text>
                            <Text style={{ fontSize: 12, color: '#1F2937' }}>{sale.factureClient}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Table:</Text>
                            <Text style={{ fontSize: 12, color: '#1F2937' }}>{sale.tableNomination}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Quantité:</Text>
                            <Text style={{ fontSize: 12, color: '#1F2937' }}>{sale.qte}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Utilisateur:</Text>
                            <Text style={{ fontSize: 12, color: '#1F2937' }}>{sale.userName}</Text>
                          </View>
                        </View>

                        <View style={styles.transactionFooterMobile}>
                          <View style={[styles.transactionTypeMobile, { backgroundColor: '#10B981' }]}>
                            <Text style={styles.transactionTypeTextMobile}>
                              Vente
                            </Text>
                          </View>
                          <Text style={[styles.transactionAmountMobile, { color: '#059669' }]}>
                            {`${sale.subTotalUsd.toFixed(2)} USD`}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              /* Détails de la vente */
              <View style={styles.detailsContainerMobile}>
                <View style={styles.detailsHeaderMobileSection}>
                  <TouchableOpacity onPress={backToTable} style={styles.backButtonMobile}>
                    <Ionicons name="arrow-back" size={20} color="#7C3AED" />
                    <Text style={styles.backButtonTextMobile}>Retour</Text>
                  </TouchableOpacity>
                  <Text style={styles.detailsTitleSectionMobile}>Détails de la vente</Text>
                </View>

                <View style={styles.detailsCardMobile}>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Produit</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.productName}</Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Client</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.factureClient}</Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Table</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.tableNomination}</Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Quantité</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.qte}</Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Prix USD</Text>
                    <Text style={[styles.detailValueMobile, styles.detailAmountMobile]}>
                      ${selectedTransaction.subTotalUsd.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Prix CDF</Text>
                    <Text style={[styles.detailValueMobile, styles.detailAmountMobile]}>
                      {selectedTransaction.subTotalCdf.toLocaleString()} CDF
                    </Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Date</Text>
                    <Text style={styles.detailValueMobile}>
                      {new Date(selectedTransaction.created).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Responsable</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.userName}</Text>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {selectedReportType === 'consumption' && (
          <>
            {/* Statistiques de consommation - Grid 2x2 */}
            <View style={styles.statsGridMobile}>
              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#eeeeee' }]}>
                  <Ionicons name="cash" size={24} color="#059669" />
                </View>
                <Text style={styles.statValueModernMobile}>{consumptionReportSummary.totalRevenueCdf.toLocaleString()}</Text>
                <Text style={styles.statLabelModernMobile}>Revenus CDF</Text>
              </View>

              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="trending-down" size={24} color="#EF4444" />
                </View>
                <Text style={styles.statValueModernMobile}>
                  {consumptionReportSummary.totalQuantitySold}
                </Text>
                <Text style={styles.statLabelModernMobile}>Quantité vendue</Text>
              </View>

              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="calculator" size={24} color="#F59E0B" />
                </View>
                <Text style={styles.statValueModernMobile}>
                  ${consumptionReportSummary.totalRevenueUsd.toFixed(2)}
                </Text>
                <Text style={styles.statLabelModernMobile}>Revenus USD</Text>
              </View>

              <View style={styles.statCardModernMobile}>
                <View style={[styles.statIconModernMobile, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="receipt" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.statValueModernMobile}>
                  {consumptionReportSummary.totalSales}
                </Text>
                <Text style={styles.statLabelModernMobile}>Nombre de ventes</Text>
              </View>
            </View>

            {/* Liste du rapport de consommation ou Détails */}
            {!selectedTransaction ? (
              <View style={styles.listSectionMobile}>
                <View style={styles.sectionHeaderMobile}>
                  <Text style={styles.sectionTitleMobile}>Rapport de Consommation ({consumptionReportData.length})</Text>
                  <TouchableOpacity
                    style={styles.printButtonMobile}
                    onPress={() => handlePrintReport('consumption')}
                  >
                    <Ionicons name="print" size={16} color="#FFFFFF" />
                    <Text style={styles.printButtonTextMobile}>PDF</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.transactionsListMobile}>
                  {consumptionReportData.map((item, index) => (
                    <TouchableOpacity key={item.productId} style={styles.transactionItemMobile} onPress={() => selectTransaction(item)}>
                      <View style={styles.transactionHeaderMobile}>
                        <View style={styles.productInfoMobile}>
                          <Text style={styles.transactionDescriptionMobile}>{item.productName}</Text>
                          <Text style={styles.transactionDateTextMobile}>
                            {item.categoryName}
                          </Text>
                          <Text style={[styles.transactionDateTextMobile, { fontSize: 12, color: '#6B7280', marginTop: 2 }]}>
                            {new Date(item.firstSaleDate).toLocaleDateString('fr-FR')} {new Date(item.firstSaleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.lastSaleDate).toLocaleDateString('fr-FR')} {new Date(item.lastSaleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.transactionFooterMobile}>
                        <View style={[styles.transactionTypeMobile, { backgroundColor: '#3B82F6' }]}>
                          <Text style={styles.transactionTypeTextMobile}>
                            {item.totalQuantitySold} vendus
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', flex: 1 }}>
                          <Text style={[styles.transactionAmountMobile, { color: '#10B981' }]}>
                            {`CDF ${(item.totalQuantitySold ? (item.totalRevenueCdf / item.totalQuantitySold).toFixed(2) : '0.00')}`}
                          </Text>
                          <Text style={[styles.transactionAmountMobile, { color: '#0E7490', fontSize: 14 }]}>
                            {`USD ${(item.totalQuantitySold ? (item.totalRevenueUsd / item.totalQuantitySold).toFixed(2) : '0.00')}`}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.transactionAmountMobile, { color: '#097B58' }]}>
                            {`${(item.totalRevenueCdf ?? 0).toFixed(2)} CDF`}
                          </Text>
                          <Text style={[styles.transactionAmountMobile, { color: '#0C4A6E', fontSize: 14 }]}>
                            {`${(item.totalRevenueUsd ?? 0).toFixed(2)} USD`}
                          </Text>
                        </View>
                        <Text style={styles.transactionStatusTextMobile}>
                          {item.numberOfSales} ventes
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              /* Détails de la consommation */
              <View style={styles.detailsContainerMobile}>
                <View style={styles.detailsHeaderMobileSection}>
                  <TouchableOpacity onPress={backToTable} style={styles.backButtonMobile}>
                    <Ionicons name="arrow-back" size={20} color="#7C3AED" />
                    <Text style={styles.backButtonTextMobile}>Retour</Text>
                  </TouchableOpacity>
                  <Text style={styles.detailsTitleSectionMobile}>Détails du produit</Text>
                </View>

                <View style={styles.detailsCardMobile}>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Produit</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.productName}</Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Catégorie</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.categoryName}</Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Quantité totale vendue</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.totalQuantitySold}</Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Nombre de ventes</Text>
                    <Text style={styles.detailValueMobile}>{selectedTransaction.numberOfSales}</Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Revenu total USD</Text>
                    <Text style={[styles.detailValueMobile, styles.detailAmountMobile]}>
                      ${selectedTransaction.totalRevenueUsd.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Revenu total CDF</Text>
                    <Text style={[styles.detailValueMobile, styles.detailAmountMobile]}>
                      {selectedTransaction.totalRevenueCdf.toLocaleString()} CDF
                    </Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Prix moyen USD</Text>
                    <Text style={styles.detailValueMobile}>
                      ${selectedTransaction.averagePriceUsd.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Prix moyen CDF</Text>
                    <Text style={styles.detailValueMobile}>
                      {selectedTransaction.averagePriceCdf.toFixed(0)} CDF
                    </Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Première vente</Text>
                    <Text style={styles.detailValueMobile}>
                      {new Date(selectedTransaction.firstSaleDate).toLocaleDateString('fr-FR')} {new Date(selectedTransaction.firstSaleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.detailRowMobile}>
                    <Text style={styles.detailLabelMobile}>Dernière vente</Text>
                    <Text style={styles.detailValueMobile}>
                      {new Date(selectedTransaction.lastSaleDate).toLocaleDateString('fr-FR')} {new Date(selectedTransaction.lastSaleDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </View>
            )}

          </>
        )}

        {selectedReportType === 'debt' && (
          <View style={styles.listSectionMobile}>
            <View style={styles.sectionHeaderMobile}>
              <Text style={styles.sectionTitleMobile}>Rapport des dettes ({filteredDebtReportData.length})</Text>
              <TouchableOpacity
                style={styles.printButtonMobile}
                onPress={loadDebtReportData}
                disabled={debtReportLoading}
              >
                <Ionicons name={debtReportLoading ? "hourglass-outline" : "refresh-outline"} size={16} color="#FFFFFF" />
                <Text style={styles.printButtonTextMobile}>{debtReportLoading ? '...' : 'Actualiser'}</Text>
              </TouchableOpacity>
            </View>

            {debtReportError && (
              <View style={styles.errorContainerMobile}>
                <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
                <Text style={styles.errorTextMobile}>{debtReportError}</Text>
                <TouchableOpacity
                  style={styles.retryButtonMobile}
                  onPress={loadDebtReportData}
                >
                  <Text style={styles.retryButtonTextMobile}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {debtReportLoading ? (
              <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="hourglass-outline" size={28} color="#6B7280" />
                <Text style={{ marginTop: 10, fontSize: 14, color: '#6B7280', fontWeight: '500' }}>
                  Chargement des données...
                </Text>
              </View>
            ) : (
              <>
                <View style={[styles.stockSearchContainerMobile, { marginBottom: 2 }]}>
                  <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIconMobile} />
                  <TextInput
                    style={[styles.stockSearchInputMobile, { flex: 1 }]}
                    placeholder="Rechercher par code facture ou client..."
                    value={debtSearch}
                    onChangeText={setDebtSearch}
                    placeholderTextColor="#9CA3AF"
                  />
                  {debtSearch.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setDebtSearch('')}
                      style={styles.searchClearButtonMobile}
                    >
                      <Ionicons name="close-circle" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.printButtonMobile, { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 8 }]}
                    onPress={() => handlePrintReport('debt')}
                    disabled={debtReportLoading || filteredDebtReportData.length === 0}
                  >
                    <Ionicons name="print" size={16} color="#FFFFFF" />
                    <Text style={styles.printButtonTextMobile}>Imprimer</Text>
                  </TouchableOpacity>
                </View>

                {filteredDebtReportData.length === 0 ? (
                  <View style={styles.emptyStateMobile}>
                    <Ionicons name="document-outline" size={32} color="#9CA3AF" />
                    <Text style={styles.emptyStateTextMobile}>Aucune facture en dette trouvée</Text>
                  </View>
                ) : (
                  <View style={styles.transactionsListMobile}>
                    {filteredDebtReportData.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.transactionItemMobile} onPress={() => handleOpenDebtModal(item)}>
                        <View style={styles.transactionHeaderMobile}>
                          <View style={styles.productInfoMobile}>
                            <Text style={styles.transactionDescriptionMobile}>{item.numCode || 'Sans code'}</Text>
                            <Text style={styles.transactionDateTextMobile}>
                              {item.client || 'Client non renseigné'}
                            </Text>
                          </View>
                          <Text style={[styles.transactionTotalMobile, { color: '#EF4444' }]}>
                            ${item.creditUsd.toFixed(2)}
                          </Text>
                        </View>

                        <View style={{ marginVertical: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Utilisateur:</Text>
                            <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.userName}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Dépôt:</Text>
                            <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.depotCode}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Ventes / Qté:</Text>
                            <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.nbVentes} / {item.qteVentes}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Date:</Text>
                            <Text style={{ fontSize: 12, color: '#1F2937' }}>{formatDate(item.created)}</Text>
                          </View>
                        </View>

                        <View style={styles.transactionFooterMobile}>
                          <View style={[styles.transactionTypeMobile, { backgroundColor: '#F59E0B' }]}>
                            <Text style={styles.transactionTypeTextMobile}>Crédit</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.transactionAmountMobile, { color: '#EF4444' }]}>
                              {item.creditCdf.toLocaleString()} CDF
                            </Text>
                            <Text style={[styles.transactionAmountMobile, { color: '#EF4444', fontSize: 14 }]}>
                              ${item.creditUsd.toFixed(2)}
                            </Text>
                          </View>
                        </View>

                        {/* Détails supplémentaires */}
                        <View style={styles.stockInfoMobile}>
                          <View style={styles.stockRowMobile}>
                            <Text style={styles.stockLabelMobile}>Total facture</Text>
                            <Text style={styles.stockValueMobile}>
                              ${item.taxationUsd.toFixed(2)} / {item.taxationCdf.toLocaleString()} CDF
                            </Text>
                          </View>
                          <View style={styles.stockRowMobile}>
                            <Text style={styles.stockLabelMobile}>Déjà payé</Text>
                            <Text style={styles.stockValueMobile}>
                              ${item.montantPayeUsd.toFixed(2)} / {item.montantPayeCdf.toLocaleString()} CDF
                            </Text>
                          </View>
                          <View style={styles.stockRowMobile}>
                            <Text style={styles.stockLabelMobile}>Réduction</Text>
                            <Text style={styles.stockValueMobile}>
                              ${item.reductionUsd.toFixed(2)} / {item.reductionCdf.toLocaleString()} CDF
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {selectedReportType === 'payment' && (
          <View style={styles.listSectionMobile}>
            <View style={styles.sectionHeaderMobile}>
              <Text style={styles.sectionTitleMobile}>Rapport paiements facture ({filteredPaymentReportData.length})</Text>
              <TouchableOpacity
                style={styles.printButtonMobile}
                onPress={loadPaymentReportData}
                disabled={paymentReportLoading}
              >
                <Ionicons name={paymentReportLoading ? "hourglass-outline" : "refresh-outline"} size={16} color="#FFFFFF" />
                <Text style={styles.printButtonTextMobile}>{paymentReportLoading ? '...' : 'Actualiser'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.stockSearchContainerMobile, { marginBottom: 8 }]}>
              <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIconMobile} />
              <TextInput
                style={[styles.stockSearchInputMobile, { flex: 1 }]}
                placeholder="Rechercher par facture, client, utilisateur ou dépôt..."
                value={paymentSearch}
                onChangeText={setPaymentSearch}
                placeholderTextColor="#9CA3AF"
              />
              {paymentSearch.length > 0 && (
                <TouchableOpacity
                  onPress={() => setPaymentSearch('')}
                  style={styles.searchClearButtonMobile}
                >
                  <Ionicons name="close-circle" size={18} color="#6B7280" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.printButtonMobile, { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 8 }]}
                onPress={() => handlePrintReport('payment')}
                disabled={paymentReportLoading || filteredPaymentReportData.length === 0}
              >
                <Ionicons name="print" size={16} color="#FFFFFF" />
                <Text style={styles.printButtonTextMobile}>Imprimer</Text>
              </TouchableOpacity>
            </View>

            {paymentReportError && (
              <View style={styles.errorContainerMobile}>
                <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
                <Text style={styles.errorTextMobile}>{paymentReportError}</Text>
                <TouchableOpacity
                  style={styles.retryButtonMobile}
                  onPress={loadPaymentReportData}
                >
                  <Text style={styles.retryButtonTextMobile}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {paymentReportLoading ? (
              <View style={{ padding: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="hourglass-outline" size={28} color="#6B7280" />
                <Text style={{ marginTop: 10, fontSize: 14, color: '#6B7280', fontWeight: '500' }}>
                  Chargement des données...
                </Text>
              </View>
            ) : filteredPaymentReportData.length === 0 ? (
              <View style={styles.emptyStateMobile}>
                <Ionicons name="document-outline" size={32} color="#9CA3AF" />
                <Text style={styles.emptyStateTextMobile}>Aucun paiement trouvé</Text>
              </View>
            ) : (
              <View style={styles.transactionsListMobile}>
                {filteredPaymentReportData.map((item) => (
                  <View key={item.id} style={styles.transactionItemMobile}>
                    <View style={styles.transactionHeaderMobile}>
                      <View style={styles.productInfoMobile}>
                        <Text style={styles.transactionDescriptionMobile}>{item.numFacture}</Text>
                        <Text style={styles.transactionDateTextMobile}>
                          {item.client || 'Anonyme'} • {item.userName}
                        </Text>
                        <Text style={[styles.transactionDateTextMobile, { fontSize: 12, color: '#6B7280', marginTop: 2 }]}>
                          {item.depotCode} • {new Date(item.datePaiement).toLocaleDateString('fr-FR')} {new Date(item.datePaiement).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <Text style={[styles.transactionTotalMobile, { color: '#059669' }]}>
                        ${item.montantPayUsd.toFixed(2)}
                      </Text>
                    </View>

                    <View style={{ marginVertical: 6 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Type:</Text>
                        <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.typePaiement}{item.remboursement ? ' (R)' : ''}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Payé:</Text>
                        <Text style={{ fontSize: 12, color: '#1F2937' }}>
                          ${item.montantPayUsd.toFixed(2)} / {item.montantPayCdf.toLocaleString()} CDF
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Facture:</Text>
                        <Text style={{ fontSize: 12, color: '#1F2937' }}>
                          ${item.taxationUsd.toFixed(2)} / {item.taxationCdf.toLocaleString()} CDF
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Ventes / Qté:</Text>
                        <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.nbVentes} / {item.qteVentes}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {selectedReportType === 'stock' && (
          <>
            {/* Section Rapport des stocks Mobile */}
            <View style={styles.stockReportSectionMobile}>
              <View style={styles.sectionHeaderMobile}>
                <Text style={[styles.sectionTitleMobile, { visibility: 'hidden' }]}>Rapport des stocks{stockMovementData.length}</Text>
                <TouchableOpacity
                  style={styles.printButtonMobile}
                  onPress={loadStockData}
                  disabled={stockLoading}
                >
                  <Ionicons name={stockLoading ? "hourglass-outline" : "refresh-outline"} size={16} color="#FFFFFF" />
                  <Text style={styles.printButtonTextMobile}>{stockLoading ? '...' : 'Actualiser'}</Text>
                </TouchableOpacity>
              </View>

              {/* États de chargement et erreurs */}
              {stockLoading && (
                <View style={styles.loadingContainerMobile}>
                  <Ionicons name="hourglass-outline" size={32} color="#3B82F6" />
                  <Text style={styles.loadingTextMobile}>Chargement des données de stock...</Text>
                </View>
              )}

              {stockError && (
                <View style={styles.errorContainerMobile}>
                  <Ionicons name="alert-circle-outline" size={20} color="#EF4444" />
                  <Text style={styles.errorTextMobile}>{stockError}</Text>
                  <TouchableOpacity
                    style={styles.retryButtonMobile}
                    onPress={loadStockData}
                  >
                    <Text style={styles.retryButtonTextMobile}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              )}

              {stockMovementData.length > 0 && (
                <>
                  {/* Section Réapprovisionnement */}
                  {stockReaprovisionData.length > 0 && (
                    <View style={styles.stockSectionMobile}>
                      <Text style={styles.subsectionTitleMobile}>
                        <Ionicons name="trending-up" size={16} color="#10B981" />
                        Réapprovisionnements ({stockReaprovisionData.length})
                      </Text>
                      <View style={styles.transactionsListMobile}>
                        {stockReaprovisionData.map((item, index) => (
                          <View key={index} style={styles.transactionItemMobile}>
                            <View style={styles.transactionHeaderMobile}>
                              <View style={styles.productInfoMobile}>
                                <Text style={styles.transactionDescriptionMobile}>{item.productName}</Text>
                                <Text style={styles.transactionDateMobile}>{formatDate(item.date)}</Text>
                              </View>
                              <Text style={[styles.transactionTotalMobile, { color: '#10B981' }]}>
                                +{item.quantity}
                              </Text>
                            </View>
                            {item.observation && (
                              <View style={styles.observationMobile}>
                                <Text style={styles.observationTextMobile}>Observation: {item.observation}</Text>
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Section Sorties de stock */}
                  {stockSortieData.length > 0 && (
                    <View style={styles.stockSectionMobile}>
                      <Text style={styles.subsectionTitleMobile}>
                        <Ionicons name="trending-down" size={16} color="#EF4444" />
                        Sorties de stock ({stockSortieData.length})
                      </Text>
                      <View style={styles.transactionsListMobile}>
                        {stockSortieData.map((item, index) => (
                          <View key={index} style={styles.transactionItemMobile}>
                            <View style={styles.transactionHeaderMobile}>
                              <View style={styles.productInfoMobile}>
                                <Text style={styles.transactionDescriptionMobile}>{item.productName}</Text>
                                <Text style={styles.transactionDateMobile}>{formatDate(item.date)}</Text>
                              </View>
                              <Text style={[styles.transactionTotalMobile, { color: '#EF4444' }]}>
                                -{item.quantity}
                              </Text>
                            </View>
                            {item.observation && (
                              <View style={styles.observationMobile}>
                                <Text style={styles.observationTextMobile}>Observation: {item.observation}</Text>
                              </View>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Section Mouvements de stock */}
                  {stockMovementData.length > 0 && (
                    <View style={styles.stockSectionMobile}>
                      <View style={styles.sectionHeaderMobile}>
                        <Text style={styles.subsectionTitleMobile}>
                          <Ionicons name="swap-vertical" size={16} color="#3B82F6" />
                          Mouvements de stock ({filteredStockMovementData.length})
                        </Text>
                        <TouchableOpacity
                          style={styles.printButtonMobile}
                          onPress={() => handlePrintReport('stock')}
                        >
                          <Ionicons name="print" size={16} color="#FFFFFF" />
                          <Text style={styles.printButtonTextMobile}>PDF</Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Filtres et recherche Mobile */}
                      <View style={styles.stockFiltersContainerMobile}>
                        <View style={styles.stockFilterRowMobile}>
                          <Text style={styles.filterLabelMobile}>Type:</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stockFilterChipsScrollMobile}>
                            <TouchableOpacity
                              style={[
                                styles.stockFilterChipMobile,
                                stockMovementFilter === 'all' && styles.stockFilterChipMobileActive
                              ]}
                              onPress={() => setStockMovementFilter('all')}
                            >
                              <Text style={[
                                styles.stockFilterChipTextMobile,
                                stockMovementFilter === 'all' && styles.stockFilterChipTextMobileActive
                              ]}>
                                Tous
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.stockFilterChipMobile,
                                stockMovementFilter === 'sortie' && styles.stockFilterChipMobileActive
                              ]}
                              onPress={() => setStockMovementFilter('sortie')}
                            >
                              <Text style={[
                                styles.stockFilterChipTextMobile,
                                stockMovementFilter === 'sortie' && styles.stockFilterChipTextMobileActive
                              ]}>
                                Sortie
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.stockFilterChipMobile,
                                stockMovementFilter === 'entree' && styles.stockFilterChipMobileActive
                              ]}
                              onPress={() => setStockMovementFilter('entree')}
                            >
                              <Text style={[
                                styles.stockFilterChipTextMobile,
                                stockMovementFilter === 'entree' && styles.stockFilterChipTextMobileActive
                              ]}>
                                Entrée
                              </Text>
                            </TouchableOpacity>
                          </ScrollView>
                        </View>
                        <View style={styles.stockSearchContainerMobile}>
                          <Ionicons name="search" size={18} color="#6B7280" style={styles.searchIconMobile} />
                          <TextInput
                            style={styles.stockSearchInputMobile}
                            placeholder="Rechercher par produit..."
                            value={stockMovementSearch}
                            onChangeText={setStockMovementSearch}
                            placeholderTextColor="#9CA3AF"
                          />
                          {stockMovementSearch.length > 0 && (
                            <TouchableOpacity
                              onPress={() => setStockMovementSearch('')}
                              style={styles.searchClearButtonMobile}
                            >
                              <Ionicons name="close-circle" size={18} color="#6B7280" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      
                      <View style={styles.transactionsListMobile}>
                        {filteredStockMovementData.map((item, index) => {
                          const isSortie = item.mouvementType?.toLowerCase() === 'sortie';
                          return (
                            <View
                              key={index}
                              style={[
                                styles.transactionItemMobile, { marginHorizontal: 10 },
                                { backgroundColor: isSortie ? '#FEF2F2' : '#ECFDF3' }
                              ]}
                            >
                              <View style={styles.transactionHeaderMobile}>
                                <View style={styles.productInfoMobile}>
                                  <Text style={styles.transactionDescriptionMobile}>{item.productName}</Text>
                                  <Text style={styles.transactionDateTextMobile}>
                                    {new Date(item.transactionDate).toLocaleDateString('fr-FR')}{' '}
                                    {new Date(item.transactionDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                </View>
                                <Text style={[styles.transactionTotalMobile, { color: isSortie ? '#EF4444' : '#10B981' }]}>
                                  {isSortie ? '-' : '+'}{item.quantity}
                                </Text>
                              </View>
                              <View style={{ marginVertical: 8 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Mouvement:</Text>
                                  <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.mouvementType}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Type:</Text>
                                  <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.transactionType}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Utilisateur:</Text>
                                  <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.userName}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Dépôt:</Text>
                                  <Text style={{ fontSize: 12, color: '#1F2937' }}>{item.depotCode}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                  <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '500' }}>Expiration:</Text>
                                  <Text style={{ fontSize: 12, color: '#1F2937' }}>
                                    {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString('fr-FR') : '-'}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </>
              )}

              {!stockError && stockMovementData.length === 0 && (
                <View style={styles.emptyStateMobile}>
                  <Ionicons name="cube-outline" size={32} color="#9CA3AF" />
                  <Text style={styles.emptyStateTextMobile}>Aucune donnée de stock trouvée</Text>
                  <Text style={styles.emptyStateSubtextMobile}>Cliquez sur "Charger les données de stock" pour commencer</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Modal DatePicker pour Mobile */}
        {!isLargeScreen && (
          <Modal
            visible={showDatePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={closeDatePicker}
          >
            <TouchableOpacity
              style={styles.datePickerOverlayMobile}
              activeOpacity={1}
              onPress={closeDatePicker}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={styles.datePickerContainerMobile}
              >
                <View style={styles.datePickerHeaderMobile}>
                  <Text style={styles.datePickerTitleMobile}>
                    {currentDateType === 'start' ? 'Date de début' : 'Date de fin'}
                  </Text>
                  <TouchableOpacity onPress={closeDatePicker}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <View style={styles.datePickerContentMobile}>
                  {/* Navigation des mois */}
                  <View style={styles.monthNavigationMobile}>
                    <TouchableOpacity onPress={() => navigateMonth('prev')} style={styles.monthNavButtonMobile}>
                      <Ionicons name="chevron-back" size={24} color="#7C3AED" />
                    </TouchableOpacity>
                    <Text style={styles.monthYearTextMobile}>
                      {formatMonthYear(currentMonth, currentYear)}
                    </Text>
                    <TouchableOpacity onPress={() => navigateMonth('next')} style={styles.monthNavButtonMobile}>
                      <Ionicons name="chevron-forward" size={24} color="#7C3AED" />
                    </TouchableOpacity>
                  </View>

                  {/* Jours de la semaine */}
                  <View style={styles.weekDaysRowMobile}>
                    {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map((day, index) => (
                      <Text key={index} style={styles.weekDayTextMobile}>{day}</Text>
                    ))}
                  </View>

                  {/* Calendrier */}
                  <View style={styles.calendarGridMobile}>
                    {generateCalendarWeeks().map((week: any[], weekIndex: number) => (
                      <View key={weekIndex} style={styles.calendarWeekMobile}>
                        {week.map((dayObj: any, dayIndex: number) => (
                          <TouchableOpacity
                            key={dayIndex}
                            style={[
                              styles.calendarDayMobile,
                              !dayObj.isCurrentMonth && styles.calendarDayInactiveMobile
                            ]}
                            onPress={() => dayObj.isCurrentMonth && selectDate(dayObj.day, dayObj.month + 1, dayObj.year)}
                            disabled={!dayObj.isCurrentMonth}
                          >
                            <Text
                              style={[
                                styles.calendarDayTextMobile,
                                !dayObj.isCurrentMonth && styles.calendarDayTextInactiveMobile
                              ]}
                            >
                              {dayObj.day}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={styles.datePickerCloseButtonMobile}
                    onPress={closeDatePicker}
                  >
                    <Text style={styles.datePickerCloseTextMobile}>Fermer</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        )}

        {/* Modals de calendrier pour mobile (bottom sheet) */}
        <BottomSheetCalendarModal
          visible={showMobileStartDateModal}
          onClose={() => setShowMobileStartDateModal(false)}
          selectedDate={startDate}
          onDateSelect={handleMobileStartDateSelect}
          title="Sélectionner la date de début"
        />
        <BottomSheetCalendarModal
          visible={showMobileEndDateModal}
          onClose={() => setShowMobileEndDateModal(false)}
          selectedDate={endDate}
          onDateSelect={handleMobileEndDateSelect}
          title="Sélectionner la date de fin"
        />
        {showDebtModal && selectedDebt && (
          <Modal
            visible={showDebtModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDebtModal(false)}
          >
            <View style={styles.pdfOverlayBackdrop}>
              <View style={[styles.pdfOverlayContainer, { maxWidth: 900 }]}>
                <View style={styles.pdfOverlayHeader}>
                  <Text style={styles.pdfOverlayTitle}>Paiements facture {selectedDebt.numCode || ''}</Text>
                  <View style={styles.pdfOverlayActions}>
                    <TouchableOpacity style={styles.pdfOverlayCloseButton} onPress={() => setShowDebtModal(false)}>
                      <Ionicons name="close" size={22} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    style={[
                      styles.reportTabButtonWeb,
                      debtPaymentTab === 'list' && styles.reportTabButtonWebActive
                    ]}
                    onPress={() => setDebtPaymentTab('list')}
                  >
                    <Ionicons name="list" size={18} color={debtPaymentTab === 'list' ? '#FFFFFF' : '#6B7280'} />
                    <Text style={[
                      styles.reportTabButtonTextWeb,
                      debtPaymentTab === 'list' && styles.reportTabButtonTextWebActive
                    ]}>Paiements</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reportTabButtonWeb,
                      debtPaymentTab === 'pay' && styles.reportTabButtonWebActive
                    ]}
                    onPress={() => setDebtPaymentTab('pay')}
                  >
                    <Ionicons name="card" size={18} color={debtPaymentTab === 'pay' ? '#FFFFFF' : '#6B7280'} />
                    <Text style={[
                      styles.reportTabButtonTextWeb,
                      debtPaymentTab === 'pay' && styles.reportTabButtonTextWebActive
                    ]}>Effectuer un paiement</Text>
                  </TouchableOpacity>
                </View>

                {debtPaymentTab === 'list' ? (
                  <View style={{ flex: 1 }}>
                    {debtPaymentsLoading ? (
                      <View style={{ padding: 20, alignItems: 'center' }}>
                        <Ionicons name="hourglass-outline" size={28} color="#6B7280" />
                        <Text style={{ marginTop: 8, color: '#6B7280', fontWeight: '500' }}>Chargement...</Text>
                      </View>
                    ) : debtPaymentsError ? (
                      <View style={styles.errorContainerWeb}>
                        <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                        <Text style={styles.errorTextWeb}>{debtPaymentsError}</Text>
                        <TouchableOpacity style={styles.retryButtonWeb} onPress={() => loadDebtPayments(selectedDebt.id)}>
                          <Text style={styles.retryButtonTextWeb}>Réessayer</Text>
                        </TouchableOpacity>
                      </View>
                    ) : debtPayments.length === 0 ? (
                      <View style={styles.emptyStateWeb}>
                        <Ionicons name="document-outline" size={32} color="#9CA3AF" />
                        <Text style={styles.emptyStateTextWeb}>Aucun paiement trouvé</Text>
                      </View>
                    ) : (
                      <View style={styles.tableWeb}>
                        <View style={styles.tableHeaderWeb}>
                          <Text style={styles.tableHeaderTextWeb}>Montant</Text>
                          <Text style={styles.tableHeaderTextWeb}>Taux</Text>
                          <Text style={styles.tableHeaderTextWeb}>Observation</Text>
                          <Text style={[styles.tableHeaderTextWeb, { borderRightWidth: 0 }]}>Date</Text>
                        </View>
                        {debtPayments.map((p: any) => (
                          <View key={p.id} style={styles.tableRowWeb}>
                            <Text style={styles.tableCellWeb}>
                              ${(p.amountUsd ?? p.amount ?? 0).toFixed ? (p.amountUsd ?? p.amount ?? 0).toFixed(2) : (p.amountUsd ?? p.amount ?? 0)} / {(p.amountCdf ?? 0).toLocaleString()} CDF
                            </Text>
                            <Text style={styles.tableCellWeb}>{p.taux ?? '-'}</Text>
                            <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{p.observation || '-'}</Text>
                            <Text style={[styles.tableCellWeb, { borderRightWidth: 0 }]}>{formatDate(p.created)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <TouchableOpacity
                        style={[
                          styles.depotChipWeb,
                          paymentDevise === 1 && styles.depotChipWebActive
                        ]}
                        onPress={() => setPaymentDevise(1)}
                      >
                        <Text style={[
                          styles.depotChipTextWeb,
                          paymentDevise === 1 && styles.depotChipTextWebActive
                        ]}>USD</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.depotChipWeb,
                          paymentDevise === 2 && styles.depotChipWebActive
                        ]}
                        onPress={() => setPaymentDevise(2)}
                      >
                        <Text style={[
                          styles.depotChipTextWeb,
                          paymentDevise === 2 && styles.depotChipTextWebActive
                        ]}>CDF</Text>
                      </TouchableOpacity>
                    </View>
                    <View>
                      <Text style={styles.filterLabelWeb}>Montant (reste {paymentDevise === 1 ? `${selectedDebt.creditUsd.toFixed(2)} USD` : `${selectedDebt.creditCdf.toLocaleString()} CDF`})</Text>
                      <TextInput
                        style={[styles.dateInputWeb, { textAlign: 'left' }]}
                        keyboardType="numeric"
                        placeholder="0"
                        value={paymentAmount}
                        onChangeText={(val) => {
                          let next = val;
                          const parsed = parseFloat(val);
                          const max = paymentDevise === 1 ? selectedDebt.creditUsd : selectedDebt.creditCdf;
                          if (!isNaN(parsed) && parsed > max) {
                            next = max.toString();
                          }
                          if (!isNaN(parsed) && parsed < 0) {
                            next = '0';
                          }
                          setPaymentAmount(next);
                        }}
                      />
                    </View>
                    <View>
                      <Text style={styles.filterLabelWeb}>Observation</Text>
                      <TextInput
                        style={[styles.dateInputWeb, { textAlign: 'left' }]}
                        placeholder="Note"
                        value={paymentObservation}
                        onChangeText={setPaymentObservation}
                      />
                    </View>
                    {paymentError && (
                      <Text style={{ color: '#EF4444', fontSize: 13 }}>{paymentError}</Text>
                    )}
                    <TouchableOpacity
                      style={[styles.printButtonWeb, { backgroundColor: paymentSubmitting ? '#A78BFA' : '#7C3AED' }]}
                      onPress={handleSubmitDebtPayment}
                      disabled={paymentSubmitting}
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.printButtonTextWeb}>{paymentSubmitting ? 'Envoi...' : 'Valider le paiement'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        )}
        {showPdfOverlay && (
          <Modal
            visible={showPdfOverlay}
            transparent
            animationType="fade"
            onRequestClose={closePdfPreview}
          >
            <View style={styles.pdfOverlayBackdrop}>
              <View style={styles.pdfOverlayContainer}>
                <View style={styles.pdfOverlayHeader}>
                  <Text style={styles.pdfOverlayTitle}>{pdfTitle || 'Aperçu du rapport'}</Text>
                  <View style={styles.pdfOverlayActions}>
                    {Platform.OS === 'web' && pdfPreviewHtml !== '' && (
                      <TouchableOpacity style={styles.pdfOverlayButton} onPress={handlePrintFromPreview}>
                        <Ionicons name="print" size={18} color="#FFFFFF" />
                        <Text style={styles.pdfOverlayButtonText}>Imprimer</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.pdfOverlayCloseButton} onPress={closePdfPreview}>
                      <Ionicons name="close" size={22} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.pdfOverlayBody}>
                  {Platform.OS === 'web' ? (
                    <View style={styles.pdfIframeContainer}>
                      {pdfPreviewHtml ? (
                        React.createElement('iframe', {
                          srcDoc: pdfPreviewHtml,
                          style: {
                            width: '100%',
                            height: '100%',
                            border: 'none',
                            borderRadius: '12px'
                          },
                          ref: iframeRef
                        } as any)
                      ) : (
                        <View style={styles.pdfOverlayEmptyState}>
                          <Ionicons name="document-outline" size={32} color="#9CA3AF" />
                          <Text style={styles.pdfOverlayEmptyText}>Aucune prévisualisation disponible.</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <ScrollView style={styles.pdfOverlayScroll} contentContainerStyle={styles.pdfOverlayScrollContent}>
                      <Text style={styles.pdfOverlaySectionTitle}>Résumé</Text>
                      {(() => {
                        const reportText = generateReportText();
                        if (!reportText) {
                          return (
                            <Text style={styles.pdfOverlayText}>Aucune donnée disponible pour ce rapport.</Text>
                          );
                        }
                        return reportText.split('\n').map((line, index) => (
                          <Text key={index} style={styles.pdfOverlayText}>
                            {line}
                          </Text>
                        ));
                      })()}
                    </ScrollView>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        )}
      </ScrollView>
    );
  }
};

const styles = StyleSheet.create({
  // Container Web
  containerWeb: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 0,
  },
  pdfOverlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pdfOverlayContainer: {
    width: '100%',
    maxWidth: 1100,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
    maxHeight: 900,
  },
  pdfOverlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pdfOverlayTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  pdfOverlayActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pdfOverlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 12,
  },
  pdfOverlayButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  pdfOverlayCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfOverlayBody: {
    flex: 1,
    width: '100%',
    minHeight: 300,
  },
  pdfIframeContainer: {
    flex: 1,
    width: '100%',
    height: 600,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pdfOverlayEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pdfOverlayEmptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  pdfOverlayScroll: {
    flex: 1,
    width: '100%',
  },
  pdfOverlayScrollContent: {
    paddingBottom: 24,
  },
  pdfOverlaySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  pdfOverlayText: {
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 20,
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
    backgroundColor: '#F9FAFB',
    padding: 0,
  },
  titleMobile: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    marginHorizontal: 16,
    marginTop: 16,
  },

  // Period Selector Web
  periodSelectorWeb: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  periodButtonWeb: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonActiveWeb: {
    backgroundColor: '#7C3AED',
  },
  periodButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodButtonTextActiveWeb: {
    color: '#FFFFFF',
  },

  // Period Selector Mobile
  periodSelectorMobile: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  periodButtonMobile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  periodButtonActiveMobile: {
    backgroundColor: '#7C3AED',
  },
  periodButtonTextMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodButtonTextActiveMobile: {
    color: '#FFFFFF',
  },

  // Main Stats Web
  mainStatsWeb: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCardWeb: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconWeb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statContentWeb: {
    flex: 1,
  },
  statValueWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabelWeb: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Main Stats Mobile
  mainStatsMobile: {
    gap: 12,
    marginBottom: 16,
  },
  statCardMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconMobile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statContentMobile: {
    flex: 1,
  },
  statValueMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabelMobile: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Report Section Web
  reportSectionWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitleWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  sectionHeaderWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tableHeaderSectionWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  printButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  printButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Report Section Mobile
  reportSectionMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitleMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  printButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  printButtonTextMobile: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Recent Orders Web
  recentOrdersListWeb: {
    gap: 12,
  },
  recentOrderWeb: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
  },
  orderHeaderWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderIdWeb: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  orderIdTextWeb: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  orderTimeWeb: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  orderTimeTextWeb: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  orderInfoWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  customerNameWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  tableNumberWeb: {
    fontSize: 14,
    color: '#6B7280',
  },
  orderItemsWeb: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
    lineHeight: 20,
  },
  orderFooterWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotalWeb: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  orderStatusWeb: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderStatusTextWeb: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Recent Orders Mobile
  recentOrdersListMobile: {
    gap: 8,
  },
  recentOrderMobile: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  orderHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderIdMobile: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  orderIdTextMobile: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  orderTimeMobile: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  orderTimeTextMobile: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
  },
  orderInfoMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  customerNameMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  tableNumberMobile: {
    fontSize: 12,
    color: '#6B7280',
  },
  orderItemsMobile: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 16,
  },
  orderFooterMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotalMobile: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  orderStatusMobile: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  orderStatusTextMobile: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Expenses Web
  expensesListWeb: {
    gap: 12,
  },
  expenseItemWeb: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  expenseHeaderWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseIdWeb: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expenseIdTextWeb: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  expenseDateWeb: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expenseDateTextWeb: {
    fontSize: 12,
    fontWeight: '500',
    color: '#DC2626',
  },
  expenseInfoWeb: {
    marginBottom: 8,
  },
  expenseDescriptionWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  expenseSupplierWeb: {
    fontSize: 14,
    color: '#6B7280',
  },
  expenseFooterWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseCategoryWeb: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expenseCategoryTextWeb: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
  },
  expenseAmountWeb: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expenseAmountTextWeb: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  expenseStatusWeb: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  expenseStatusTextWeb: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Expenses Mobile
  expensesListMobile: {
    gap: 8,
  },
  expenseItemMobile: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  expenseHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  expenseIdMobile: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  expenseIdTextMobile: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  expenseDateMobile: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  expenseDateTextMobile: {
    fontSize: 10,
    fontWeight: '500',
    color: '#DC2626',
  },
  expenseInfoMobile: {
    marginBottom: 6,
  },
  expenseDescriptionMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  expenseSupplierMobile: {
    fontSize: 12,
    color: '#6B7280',
  },
  expenseFooterMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseCategoryMobile: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  expenseCategoryTextMobile: {
    fontSize: 10,
    fontWeight: '500',
    color: '#4B5563',
  },
  expenseAmountMobile: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  expenseAmountTextMobile: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  expenseStatusMobile: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  expenseStatusTextMobile: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Tabs Web
  tabsContainerWeb: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tableContainerWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  tabWeb: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabActiveWeb: {
    backgroundColor: '#7C3AED',
  },
  tabTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActiveWeb: {
    color: '#FFFFFF',
  },

  // Tabs Mobile
  tabsContainerMobile: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabMobile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabActiveMobile: {
    backgroundColor: '#7C3AED',
  },
  tabTextMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActiveMobile: {
    color: '#FFFFFF',
  },

  // Filters Web
  filtersSectionWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterRowWeb: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  filterGroupWeb: {
    flex: 1,
  },
  filterLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  typeSelectorWeb: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 4,
  },
  typeButtonWeb: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  typeButtonActiveWeb: {
    backgroundColor: '#7C3AED',
  },
  typeButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  typeButtonTextActiveWeb: {
    color: '#FFFFFF',
  },

  // Filters Mobile
  filtersSectionMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterRowMobile: {
    gap: 12,
    marginBottom: 12,
  },
  filterGroupMobile: {
    flex: 1,
  },
  filterLabelMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  typeSelectorMobile: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 3,
  },
  typeButtonMobile: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 3,
    alignItems: 'center',
  },
  typeButtonActiveMobile: {
    backgroundColor: '#7C3AED',
  },
  typeButtonTextMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  typeButtonTextActiveMobile: {
    color: '#FFFFFF',
  },

  // Table Web
  tableSectionWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tableWeb: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeaderWeb: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderTextWeb: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  tableRowWeb: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableCellWeb: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  tableCellTextWeb: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  quantityBadgeWeb: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBadgeTextWeb: {
    fontSize: 13,
    fontWeight: '600',
  },
  typeCellWeb: {
    justifyContent: 'center',
  },
  descriptionCellWeb: {
    textAlign: 'left',
    flex: 2,
  },
  amountCellWeb: {
    fontWeight: '600',
  },
  typeBadgeWeb: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeTextWeb: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadgeWeb: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeTextWeb: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // List Mobile
  listSectionMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionsListMobile: {
    gap: 8,
  },
  transactionItemMobile: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  transactionHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  transactionIdMobile: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  transactionIdTextMobile: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  transactionDateMobile: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  transactionDateTextMobile: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
  },
  transactionDescriptionMobile: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 8,
  },
  transactionFooterMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  transactionTypeMobile: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  transactionTypeTextMobile: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  transactionAmountMobile: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionStatusMobile: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  transactionStatusTextMobile: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Totals Web
  totalsSectionWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  totalsGridWeb: {
    flexDirection: 'row',
    gap: 16,
  },
  totalCardWeb: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalIconWeb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  totalContentWeb: {
    flex: 1,
  },
  totalValueWeb: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  totalLabelWeb: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Totals Mobile
  totalsSectionMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  totalsGridMobile: {
    gap: 8,
  },
  totalCardMobile: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalIconMobile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  totalContentMobile: {
    flex: 1,
  },
  totalValueMobile: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  totalLabelMobile: {
    fontSize: 12,
    color: '#6B7280',
  },

  // Modal Web
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  modalBody: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    flex: 2,
    textAlign: 'right',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  typeBadgeModal: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeTextModal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadgeModal: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeTextModal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Modal Mobile
  modalContentMobile: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHandleMobile: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitleMobile: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButtonMobile: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  modalBodyMobile: {
    gap: 8,
  },
  detailRowMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailLabelMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    flex: 1,
  },
  detailValueMobile: {
    fontSize: 12,
    color: '#1F2937',
    flex: 2,
    textAlign: 'right',
  },
  amountValueMobile: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  typeBadgeModalMobile: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeBadgeTextModalMobile: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadgeModalMobile: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeTextModalMobile: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Date Picker Web
  dateInputWeb: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTextWeb: {
    fontSize: 14,
    color: '#374151',
  },
  calendarHeaderWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarMonthWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  calendarWeekdaysWeb: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayWeb: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    paddingVertical: 8,
  },
  calendarGridWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayWeb: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginBottom: 4,
  },
  calendarDaySelectedWeb: {
    backgroundColor: '#3B82F6',
  },
  calendarDayDisabledWeb: {
    opacity: 0.3,
  },
  calendarDayTextWeb: {
    fontSize: 14,
    color: '#374151',
  },
  calendarDayTextSelectedWeb: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  calendarDayTextDisabledWeb: {
    color: '#9CA3AF',
  },

  // Date Picker Mobile
  dateInputMobile: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateTextMobile: {
    fontSize: 12,
    color: '#374151',
  },
  calendarHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarMonthMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  calendarWeekdaysMobile: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayMobile: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '500',
    color: '#6B7280',
    paddingVertical: 6,
  },
  calendarDaySelectedMobile: {
    backgroundColor: '#3B82F6',
  },
  calendarDayDisabledMobile: {
    opacity: 0.3,
  },
  calendarDayTextSelectedMobile: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  calendarDayTextDisabledMobile: {
    color: '#9CA3AF',
  },

  // Date Picker Modal Web
  datePickerModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 1000,
  },
  datePickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 24,
    width: '100%',
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  datePickerModalBody: {
    gap: 16,
  },

  // Date Picker Modal Mobile
  datePickerModalContentMobile: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 16,
    width: '100%',
    marginTop: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  datePickerModalHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerModalTitleMobile: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  datePickerModalBodyMobile: {
    gap: 12,
  },

  // Nouveaux styles pour les informations de stock mobile
  stockInfoMobile: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 8,
    marginVertical: 8,
  },
  stockRowMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stockLabelMobile: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  stockValueMobile: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },
  amountsContainerMobile: {
    alignItems: 'flex-end',
  },
  transactionTotalMobile: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // Tabs de rapport
  reportTabsContainerWeb: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 6,
    gap: 8,
    alignSelf: 'flex-start',
  },
  reportTabButtonWeb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  reportTabButtonWebActive: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 3,
  },
  reportTabButtonTextWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  reportTabButtonTextWebActive: {
    color: '#FFFFFF',
  },
  reportTabsContainerMobile: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 4,
    gap: 6,
  },
  reportTabButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 170,
  },
  reportTabButtonMobileActive: {
    backgroundColor: '#7C3AED',
    elevation: 2,
  },
  reportTabButtonTextMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  reportTabButtonTextMobileActive: {
    color: '#FFFFFF',
  },
  reportTabsScrollMobile: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 6,
  },

  // Modern Date Grid Mobile
  filtersSectionModernMobile: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  depotSelectorContainerWeb: {
    marginTop: 16,
    paddingHorizontal: 4,
  },
  depotChipsWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  depotChipWeb: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  depotChipWebActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  depotChipTextWeb: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  depotChipTextWebActive: {
    color: '#FFFFFF',
  },
  depotBadgeWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 8,
  },
  depotBadgeTextWeb: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4C1D95',
  },
  depotHelperText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  depotHelperTextError: {
    color: '#DC2626',
  },
  depotSelectorContainerMobile: {
    marginBottom: 16,
    marginHorizontal: 16,
  },
  depotChipsScrollMobile: {
    marginTop: 8,
  },
  depotChipMobile: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  depotChipMobileActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  depotChipTextMobile: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  depotChipTextMobileActive: {
    color: '#FFFFFF',
  },
  depotBadgeMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 8,
  },
  depotBadgeTextMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4C1D95',
  },
  depotHelperTextMobile: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  dateGridMobile: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dateCardMobile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  dateLabelMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  dateValueMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },

  // Modern Stats Grid Mobile
  statsGridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  statCardModernMobile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIconModernMobile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValueModernMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabelModernMobile: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Détails Container Mobile
  detailsContainerMobile: {
    marginHorizontal: 16,
  },
  detailsHeaderMobileSection: {
    marginBottom: 16,
  },
  backButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backButtonTextMobile: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7C3AED',
  },
  detailsTitleSectionMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  detailsCardMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailAmountMobile: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: 'bold',
  },

  // Styles pour les images de produits
  productImageWeb: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  productImageContainerMobile: {
    marginRight: 12,
  },
  productImageMobile: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  productInfoMobile: {
    flex: 1,
  },

  // Styles pour la carte de détails de transaction
  transactionDetailsCardWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  transactionDetailsHeaderWeb: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonTextWeb: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  transactionDetailsContentWeb: {
    gap: 16,
  },
  transactionDetailsRowWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  transactionDetailsLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  transactionDetailsValueWeb: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  transactionDetailsAmountWeb: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionDetailsBadgeWeb: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  transactionDetailsBadgeTextWeb: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  transactionDetailsStatusWeb: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  transactionDetailsStatusTextWeb: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Styles pour le calendrier personnalisé
  customCalendarWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  navButtonWeb: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  monthYearTextWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  dayNamesRowWeb: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayNameTextWeb: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    paddingVertical: 8,
  },
  calendarDayInactiveWeb: {
    opacity: 0.3,
  },
  calendarDayTextInactiveWeb: {
    color: '#9CA3AF',
  },
  closeCalendarButtonWeb: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    alignSelf: 'center',
  },
  closeCalendarTextWeb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },

  // Styles pour le rapport des stocks
  loadStockButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadStockButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadStockButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  loadStockButtonTextMobile: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  stockReportSectionWeb: {
    marginBottom: 24,
  },
  stockReportSectionMobile: {
    marginBottom: 16,
  },
  stockSectionWeb: {
    marginBottom: 24,
  },
  stockSectionMobile: {
    marginBottom: 16,
  },
  subsectionTitleWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subsectionTitleMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loadingContainerWeb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingTextWeb: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  loadingContainerMobile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingTextMobile: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainerWeb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    margin: 20,
  },
  errorTextWeb: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  errorContainerMobile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    margin: 16,
  },
  errorTextMobile: {
    marginTop: 8,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButtonWeb: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  retryButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  retryButtonMobile: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 6,
  },
  retryButtonTextMobile: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyStateWeb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTextWeb: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptyStateSubtextWeb: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  emptyStateMobile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateTextMobile: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  emptyStateSubtextMobile: {
    marginTop: 6,
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  observationMobile: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  observationTextMobile: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  // Styles pour les filtres de mouvement de stock Web
  stockFiltersContainerWeb: {
    marginBottom: 16,
    gap: 12,
  },
  stockFilterRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stockFilterChipsWeb: {
    flexDirection: 'row',
    gap: 8,
  },
  stockFilterChipWeb: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  stockFilterChipWebActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  stockFilterChipTextWeb: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  stockFilterChipTextWebActive: {
    color: '#FFFFFF',
  },
  stockSearchContainerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  searchIconWeb: {
    marginRight: 8,
  },
  stockSearchInputWeb: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    padding: 0,
  },
  searchClearButtonWeb: {
    marginLeft: 8,
    padding: 4,
  },
  // Styles pour les filtres de mouvement de stock Mobile
  stockFiltersContainerMobile: {
    marginBottom: 12,
    gap: 10,
    paddingHorizontal: 16,
  },
  stockFilterRowMobile: {
    gap: 8,
  },
  stockFilterChipsScrollMobile: {
    marginTop: 4,
  },
  stockFilterChipMobile: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  stockFilterChipMobileActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  stockFilterChipTextMobile: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  stockFilterChipTextMobileActive: {
    color: '#FFFFFF',
  },
  stockSearchContainerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  searchIconMobile: {
    marginRight: 8,
  },
  stockSearchInputMobile: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    padding: 0,
  },
  searchClearButtonMobile: {
    marginLeft: 8,
    padding: 2,
  },
  // Styles pour Modal DatePicker Mobile
  datePickerOverlayMobile: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainerMobile: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  datePickerHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerTitleMobile: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  datePickerContentMobile: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  monthNavigationMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthNavButtonMobile: {
    padding: 8,
  },
  monthYearTextMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  weekDaysRowMobile: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekDayTextMobile: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    width: 40,
    textAlign: 'center',
  },
  calendarGridMobile: {
    gap: 4,
  },
  calendarWeekMobile: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 4,
  },
  calendarDayMobile: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarDayInactiveMobile: {
    opacity: 0.3,
  },
  calendarDayTextMobile: {
    fontSize: 14,
    color: '#1F2937',
  },
  calendarDayTextInactiveMobile: {
    color: '#9CA3AF',
  },
  datePickerCloseButtonMobile: {
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  datePickerCloseTextMobile: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReportsComponent;

