import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getExchangeRate } from '../api/configurationApi';
import { getProductConsumptionReport, getSellingReport, getTodayDateRange } from '../api/reportApi';
import { getStockReaprovision, getStockSortie } from '../api/stockReportApi';
import { getUsers } from '../api/userApi';
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

// Composant Rapports
const ReportsComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  const [showPdfOverlay, setShowPdfOverlay] = useState<boolean>(false);
  const [pdfData, setPdfData] = useState<any>(null);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [selectedReportType, setSelectedReportType] = useState<'sales' | 'consumption' | 'stock'>('sales');


  function formatDateForAPI(date: Date) {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
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
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  // États pour les données de rapport de vente
  const [sellingReportData, setSellingReportData] = useState<SellingReportData[]>([]);
  const [sellingReportLoading, setSellingReportLoading] = useState(false);
  const [sellingReportError, setSellingReportError] = useState<string | null>(null);

  // États pour les données de rapport de consommation
  const [consumptionReportData, setConsumptionReportData] = useState<ConsumptionReportData[]>([]);
  const [consumptionReportLoading, setConsumptionReportLoading] = useState(false);
  const [consumptionReportError, setConsumptionReportError] = useState<string | null>(null);

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
    key: 'sales' | 'consumption' | 'stock';
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    { key: 'sales', label: 'Ventes & Consommation', icon: 'trending-up' },
    /*{ key: 'consumption', label: 'Rapport Consommation', icon: 'stats-chart' },
    { key: 'stock', label: 'Rapport des stocks', icon: 'cube' }*/
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



    const response = await getSellingReport(dateRange.startDate, dateRange.endDate);

    if (response.success === false) {
      setSellingReportError(response.error || 'Erreur lors du chargement du rapport de vente');
      setSellingReportData([]);
    } else {
      setSellingReportData(response?.data || []);
    }

    setSellingReportLoading(false);
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

  // Fonction pour charger les données de stock
  const loadStockData = async () => {
    setStockLoading(true);
    setStockError(null);

    try {
      const startDateFormatted = formatDateForAPI(startDate);
      const endDateFormatted = formatDateForAPI(endDate);
      const [reaprovisionResponse, sortieResponse] = await Promise.all([
        getStockReaprovision(startDateFormatted, endDateFormatted),
        getStockSortie(startDateFormatted, endDateFormatted)
      ]);

      setStockReaprovisionData(reaprovisionResponse?.data || []);
      setStockSortieData(sortieResponse?.data || []);
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

  // Load exchange rate, users and categories when component mounts
  useEffect(() => {
    loadExchangeRate();
    loadUsers();
    loadCategories();
  }, []);

  // Load data when component mounts or date range changes
  useEffect(() => {
    if (selectedReportType === 'sales') {
      loadSellingReportData();
    } else if (selectedReportType === 'consumption') {
      loadConsumptionReportData();
    }
  }, [selectedReportType, dateRange]);

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
  const handlePrintReport = (reportType: 'sales' | 'consumption') => {
    const data = reportType === 'sales' ? filteredSellingReportData : consumptionReportData;

    if (!data || data.length === 0) {
      alert('Aucune donnée à imprimer.');
      return;
    }

    // Pour mobile, afficher la vue PDF complète
    if (Platform.OS !== 'web') {
      const reportTitle = reportType === 'sales' ? 'Rapport de Vente' : 'Rapport de Consommation';
      setPdfTitle(reportTitle);
      setPdfData(data);
      setPdfPreviewHtml('');
      setShowPdfOverlay(true);
      return;
    }

    try {
      const reportTitle = reportType === 'sales' ? 'Rapport de Vente' : 'Rapport de Consommation';
      const currentDate = new Date().toLocaleDateString('fr-FR');
      const startDate = new Date(dateRange.startDate).toLocaleDateString('fr-FR');
      const endDate = new Date(dateRange.endDate).toLocaleDateString('fr-FR');

      // Générer le HTML pour l'impression
      const printHTML = generatePrintHTML(reportType, data, reportTitle, currentDate, startDate, endDate);

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
  const generatePrintHTML = (reportType: 'sales' | 'consumption', data: any[], reportTitle: string, currentDate: string, startDate: string, endDate: string) => {
    let tableHTML = '';

    if (reportType === 'sales') {
      tableHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #7C3AED; color: white;">
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Produit</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Client</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Table</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Prix Unitaire</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Prix CDF</th>
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
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">CDF ${item.priceCdf || '0'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.qte || '0'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${((item.priceCdf || 0) * (item.qte || 0)).toLocaleString()} CDF</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${item.userName || ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(item.created).toLocaleDateString('fr-FR')} ${new Date(item.created).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
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
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Catégorie</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Produit</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Quantité</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Prix unitaire CDF</th>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Prix unitaire CDF * Quantité</th>
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
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">CDF ${(item.totalRevenueCdf / item.totalQuantitySold).toFixed(2)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">CDF ${item.totalRevenueCdf.toFixed(2) || '0.00'}</td>
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
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${reportTitle} - CHEZ JESSICA</title>
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
          <div class="restaurant-name">CHEZ JESSICA</div>
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
          ` : `
            <p><strong>Total des revenus:</strong> $${data.reduce((sum, item) => sum + (item.totalRevenueUsd || 0), 0).toFixed(2)}</p>
            <p><strong>Total des revenus CDF:</strong> ${data.reduce((sum, item) => sum + (item.totalRevenueCdf || 0), 0).toLocaleString()} CDF</p>
            <p><strong>Quantité totale vendue:</strong> ${data.reduce((sum, item) => sum + (item.totalQuantitySold || 0), 0)}</p>
            <p><strong>Nombre total de ventes:</strong> ${data.reduce((sum, item) => sum + (item.numberOfSales || 0), 0)}</p>
          `}
        </div>
        
        <div class="footer">
          <p>CHEZ JESSICA - Restaurant Manager</p>
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

          {selectedReportType === 'sales' ? (
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
                              {sale.subTotalCdf.toLocaleString()} CDF
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
          ) : (
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
                    <Text style={styles.tableHeaderTextWeb}>Quantité vendue</Text>
                    <Text style={styles.tableHeaderTextWeb}>Prix unitaire CDF * Quantité</Text>
                    <Text style={styles.tableHeaderTextWeb}>Nombre de ventes</Text>
                    <Text style={styles.tableHeaderTextWeb}>Période</Text>
                  </View>

                  {consumptionReportData.map((item, index) => (
                    <View key={item.productId} style={styles.tableRowWeb}>
                      <Text style={styles.tableCellWeb}>{item.categoryName}</Text>
                      <Text style={[styles.tableCellWeb, styles.descriptionCellWeb]}>{item.productName}</Text>
                      <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#059669' }]}>
                      {(item.totalRevenueCdf / item.totalQuantitySold).toFixed(2)} CDF
                      </Text>
                      <Text style={styles.tableCellWeb}>{item.totalQuantitySold}</Text>
                      <Text style={[styles.tableCellWeb, styles.amountCellWeb, { color: '#097B58' }]}>
                        {item.totalRevenueCdf.toFixed(2)} CDF
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

          {selectedReportType === 'stock' && (
            <>
              {/* Section Rapport des stocks */}
              <View style={styles.stockReportSectionWeb}>
                <Text style={styles.sectionTitleWeb}>Rapport des stocks</Text>

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

                {!stockLoading && !stockError && (stockReaprovisionData.length > 0 || stockSortieData.length > 0) && (
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
                  </>
                )}

                {!stockLoading && !stockError && stockReaprovisionData.length === 0 && stockSortieData.length === 0 && (
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
      </View>
    );
  }

  // Version Mobile/Table
  return (
    <ScrollView style={styles.containerMobile}>
      <Text style={styles.titleMobile}>Rapports</Text>

      {/* Navigation des tabs de rapport - Modern Design */}
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

      {selectedReportType === 'sales' ? (
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
          </View>

          {/* Filtre par catégorie - Mobile - Masqué */}
          {/* <View style={{ marginBottom: 16, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 }}>Filtrer par catégorie:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
            <TouchableOpacity 
              style={[
                { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', marginRight: 8 },
                !selectedCategoryId && { backgroundColor: '#10B981', borderColor: '#10B981' }
              ]}
              onPress={() => setSelectedCategoryId(null)}
            >
              <Text style={[
                { fontSize: 12, fontWeight: '500', color: '#6B7280' },
                !selectedCategoryId && { color: '#FFFFFF' }
              ]}>
                Toutes
              </Text>
            </TouchableOpacity>
            {Array.isArray(categories) && categories.map((category) => (
              <TouchableOpacity 
                key={category.id}
                style={[
                  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#D1D5DB', marginRight: 8 },
                  selectedCategoryId === category.id && { backgroundColor: '#10B981', borderColor: '#10B981' }
                ]}
                onPress={() => setSelectedCategoryId(category.id)}
              >
                <Text style={[
                  { fontSize: 12, fontWeight: '500', color: '#6B7280' },
                  selectedCategoryId === category.id && { color: '#FFFFFF' }
                ]}>
                  {category.categoryName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View> */}

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
                          {sale.subTotalCdf.toLocaleString()} CDF
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
      ) : (
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
                      <Text style={[styles.transactionAmountMobile, { color: '#10B981', marginLeft: 15 }]}>

                        {(item.totalRevenueCdf / item.totalQuantitySold).toFixed(2)} CDF
                      </Text>
                      <Text style={[styles.transactionAmountMobile, { color: '#10B981' }]}>

                        {item.totalRevenueCdf.toFixed(2)} CDF
                      </Text>
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

      {selectedReportType === 'stock' && (
        <>
          {/* Section Rapport des stocks Mobile */}
          <View style={styles.stockReportSectionMobile}>
            <Text style={styles.sectionTitleMobile}>Rapport des stocks</Text>

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

            {!stockLoading && !stockError && (stockReaprovisionData.length > 0 || stockSortieData.length > 0) && (
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
              </>
            )}

            {!stockLoading && !stockError && stockReaprovisionData.length === 0 && stockSortieData.length === 0 && (
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
    flexDirection: 'row',
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
  },
  tableRowWeb: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tableCellWeb: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 16,
    marginHorizontal: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 4,
    gap: 6,
  },
  reportTabButtonMobile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
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

  // Modern Date Grid Mobile
  filtersSectionModernMobile: {
    marginBottom: 16,
    marginHorizontal: 16,
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

