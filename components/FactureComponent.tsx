import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCategories } from '../api/categoryApi';
import { getExchangeRate } from '../api/configurationApi';
import { addFacturePayment, deleteFacture, deleteFacturePayment, getAllFactures, getFacturePayments, getFacturesByDateRange, markFactureAsAborted, markFactureAsPayed, printFacture, updateFacture } from '../api/factureApi';
import { getProducts } from '../api/productApi';
import { getTables } from '../api/tableApi';
import { useFetch } from '../hooks/useFetch';
import { getUserData } from '../utils/storage';
import BottomSheetCalendarModal from './ui/BottomSheetCalendarModal';
import CalendarModal from './ui/CalendarModal';


// Interface pour les props du composant Factures
interface FactureComponentProps {
  onInvoiceCountChange?: (count: number) => void;
}

// Fonction pour formater les données de facture en format de reçu
const formatInvoiceForReceipt = (invoice: any) => {
  // Utiliser la date de la facture ou la date actuelle
  const factureDate = invoice.date ? new Date(invoice.date).toISOString() : new Date().toISOString();
  return {
    organisationName: "RESTAURANT CHEZ JESSICA",
    adresse1: "611b av des chutes",
    adresse2: "Lubumbashi, RDC",
    phone1: "(+243) 811-400-523",
    phone2: "(+243) 998-554-300",
    rccm: "RCCM .P16-A-4666",
    idOrganisation: "ID.NAT.6-93-N4666",
    numeroImpot: "NUMERO IMPOT, A2423042Y",
    logoPath: "images/logo.png",
    tableName: invoice.tableNomination || "N/A",
    date: factureDate,
    time: factureDate,
    items: invoice.items?.map((item: any) => ({
      productName: item.productName || item.name || "Produit",
      price: item.priceCdf || 0,
      qte: item.qte || item.quantity || 1,
      total: (item.priceCdf || 0) * (item.qte || item.quantity || 1)
    })) || [],
    total: invoice.amountPaidCdf || 0,
    netTotal: invoice.amountPaidUsd || 0,
    thanksMessage: "Thank you for your business! Come again soon!"
  };
};

// Composant Facture
const FactureComponent = ({ onInvoiceCountChange }: FactureComponentProps) => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  const paymentMethodOptions = ['Cash', 'EquityBCDC', 'Ecobank', 'Orange-Money', 'M-Pesa', 'Airtel-Money'];
  const paymentDeviseOptions = [
    { label: 'CDF', value: 2 },
    { label: 'USD', value: 1 },
  ];

  // États pour les filtres
  const [selectedStatus, setSelectedStatus] = useState('Toutes');
  const [searchTerm, setSearchTerm] = useState('');
  
  // États pour le filtrage par date
  const [startDate, setStartDate] = useState<Date>(() => {
    // Date d'aujourd'hui à 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    // Date d'aujourd'hui à 23:59:59
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDateRange, setCustomDateRange] = useState(false);
  
  // States for direct date/time editing
  const [startDateText, setStartDateText] = useState('');
  const [endDateText, setEndDateText] = useState('');
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [isEditingEndDate, setIsEditingEndDate] = useState(false);
  
  // États pour les modals de calendrier (web uniquement)
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  
  // États pour les modals de calendrier mobile (bottom sheet)
  const [showMobileStartDateModal, setShowMobileStartDateModal] = useState(false);
  const [showMobileEndDateModal, setShowMobileEndDateModal] = useState(false);

  // États pour la modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('details');
  
  // États pour la modal mobile étendue
  const [activeMobileModalTab, setActiveMobileModalTab] = useState('details');
  const [selectedInvoiceForMobileEdit, setSelectedInvoiceForMobileEdit] = useState<any>(null);
  
  // États pour la section droite (Web uniquement)
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<any>(null);
  const [activeDetailsTab, setActiveDetailsTab] = useState('edit');
  
  // État pour le loading du bouton modifier facture
  const [isUpdatingInvoice, setIsUpdatingInvoice] = useState(false);
  
  // État pour la modal d'impression
  const [showPrintModal, setShowPrintModal] = useState(false);

  // États pour le rapport des factures
  const [showInvoiceReportModal, setShowInvoiceReportModal] = useState(false);
  const [invoiceReportHtml, setInvoiceReportHtml] = useState('');
  const [invoiceReportTitle, setInvoiceReportTitle] = useState('Rapport des factures');
  const [pendingInvoiceAutoPrint, setPendingInvoiceAutoPrint] = useState(false);
  const [invoiceReportData, setInvoiceReportData] = useState<Invoice[]>([]);
  const invoiceReportIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDevise, setPaymentDevise] = useState<number>(1);
  const [paymentObservation, setPaymentObservation] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState<boolean>(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [showPaymentsModal, setShowPaymentsModal] = useState<boolean>(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const invoiceTotals = useMemo(() => {
    if (!selectedInvoiceForDetails) {
      return {
        basketTotalCdf: 0,
        basketTotalUsd: 0,
        reductionCdf: 0,
        reductionUsd: 0,
        paidCdf: 0,
        paidUsd: 0,
        remainingCdf: 0,
        remainingUsd: 0,
      };
    }
    const items = Array.isArray(selectedInvoiceForDetails.items)
      ? selectedInvoiceForDetails.items
      : [];
    const basketTotalCdf = items.reduce((sum: number, item: any) => {
      const subtotal =
        Number(item.subTotalCdf) ||
        Number(item.priceCdf || 0) * Number(item.qte || item.quantity || 1);
      return sum + (Number.isFinite(subtotal) ? subtotal : 0);
    }, 0);
    const basketTotalUsd = items.reduce((sum: number, item: any) => {
      const subtotal =
        Number(item.subTotalUsd) ||
        Number(item.priceUsd || 0) * Number(item.qte || item.quantity || 1);
      return sum + (Number.isFinite(subtotal) ? subtotal : 0);
    }, 0);
    const reductionCdf = Number(selectedInvoiceForDetails.reductionCdf) || 0;
    const reductionUsd = Number(selectedInvoiceForDetails.reductionUsd) || 0;
    const fallbackPaidCdf = basketTotalCdf - reductionCdf;
    const fallbackPaidUsd = basketTotalUsd - reductionUsd;
    const paidCdf = Number(
      selectedInvoiceForDetails.amountPaidCdf ?? fallbackPaidCdf
    );
    const paidUsd = Number(
      selectedInvoiceForDetails.amountPaidUsd ?? fallbackPaidUsd
    );
    const remainingCdfRaw = basketTotalCdf - reductionCdf - paidCdf;
    const remainingUsdRaw = basketTotalUsd - reductionUsd - paidUsd;
    return {
      basketTotalCdf,
      basketTotalUsd,
      reductionCdf,
      reductionUsd,
      paidCdf,
      paidUsd,
      remainingCdf: Math.max(0, Math.floor(remainingCdfRaw)),
      remainingUsd: Math.max(0, Number(remainingUsdRaw.toFixed(2))),
    };
  }, [selectedInvoiceForDetails]);
  const paymentLimit = Math.max(
    0,
    paymentDevise === 1 ? invoiceTotals.remainingUsd : invoiceTotals.remainingCdf
  );
  const paymentAmountNumber =
    paymentDevise === 1
      ? Number(paymentAmount.replace(',', '.'))
      : Number(paymentAmount);
  const isPaymentAmountPositive =
    Number.isFinite(paymentAmountNumber) && paymentAmountNumber > 0;
  const formatPaymentDate = (value?: string) => {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // États pour le taux de change
  const [exchangeRate, setExchangeRate] = useState<number>(2800); // Valeur par défaut
  
  const [userDepotCode, setUserDepotCode] = useState<string | null>(null);
  const productFetchParams = useMemo(
    () => (userDepotCode ? { depotCode: userDepotCode } : null),
    [userDepotCode]
  );

  useEffect(() => {
    const loadDepot = async () => {
      try {
        const user = await getUserData();
        if (user?.depotCode) {
          setUserDepotCode(user.depotCode);
        }
      } catch (error) {
        console.error('Erreur lors du chargement du dépôt utilisateur:', error);
      }
    };

    loadDepot();
  }, []);

  // États pour les catégories et produits depuis l'API
  const { data: apiCategories, loading: categoriesLoading, error: categoriesError } = useFetch(getCategories);
  const { data: apiProducts, loading: productsLoading, error: productsError } = useFetch(getProducts, productFetchParams as any);
  const { data: apiTables, loading: tablesLoading, error: tablesError } = useFetch(getTables);
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState('Toutes');
  
  // États pour la sélection de produits
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [selectedProductCategory, setSelectedProductCategory] = useState('Toutes');
  
  // État pour l'onglet actif dans la section mobile
  const [activeMobileTab, setActiveMobileTab] = useState<'details' | 'products'>('details');
  
  // État pour les articles modifiables dans l'onglet Détails
  const [editableItems, setEditableItems] = useState<any[]>([]);
  
  // États pour l'ajout de produits dans l'onglet Produits
  const [selectedProductForAddition, setSelectedProductForAddition] = useState<any>(null);
  const [quantityForAddition, setQuantityForAddition] = useState<string>('1');

  // Initialiser les articles modifiables quand une facture est sélectionnée
  useEffect(() => {
    if (selectedInvoice?.items) {
      // S'assurer que tous les champs requis sont présents dans editableItems
      const formattedItems = selectedInvoice.items.map((item: any) => ({
        ...item,
        id: item.id || item.productId, // S'assurer qu'il y a un ID
        productId: item.productId || item.id, // ID du produit
        qte: item.qte || item.quantity || 1,
        quantity: item.qte || item.quantity || 1,
        priceUsd: item.priceUsd || 0,
        priceCdf: item.priceCdf || 0,
        subTotalUsd: item.subTotalUsd || (item.priceUsd || 0) * (item.qte || item.quantity || 1),
        subTotalCdf: item.subTotalCdf || (item.priceCdf || 0) * (item.qte || item.quantity || 1),
        taux: item.taux || exchangeRate
      }));
      
      setEditableItems(formattedItems);
    }
  }, [selectedInvoice, exchangeRate]);

  // Interface pour les factures
  interface Invoice {
    id: string;
    customerName: string;
    description: string;
    date: string;
    status: number;
    totalCdf: number;
    totalUsd: number;
    amountPaidCdf: number;
    amountPaidUsd: number;
    reductionCdf: number;
    reductionUsd: number;
    items: any[];
    tableId?: string;
    tableNomination?: string;
    userId?: string;
    userName?: string;
    createdAt?: string;
    updatedAt?: string;
    typePaiement?: string | null;
    dette?: boolean;
  }

  // Récupération des factures depuis l'API avec filtrage par date
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<any>(null);

  // Function to fetch invoices by date range
  const fetchInvoicesByDateRange = async (start: Date, end: Date) => {
    try {
      setInvoicesLoading(true);
      setInvoicesError(null);
      
      let response;
      try {
        // Try the date range API first
        response = await getFacturesByDateRange(start, end);
      } catch (dateRangeError) {
        // Fallback to getAllFactures if date range API fails
        response = await getAllFactures();
      }
      
      // Handle the API response structure - it might be wrapped in a data property
      let invoicesData = response;
      if (response && response.data && Array.isArray(response.data)) {
        invoicesData = response.data;
      } else if (response && Array.isArray(response)) {
        invoicesData = response;
      } else {
        setInvoices([]);
        return response;
      }
      
      // Transform the API response to match our Invoice interface
      if (invoicesData && Array.isArray(invoicesData)) {
        const transformedInvoices: Invoice[] = invoicesData.map((invoice: any) => ({
          id: invoice.id,
          customerName: invoice.client || 'Client anonyme',
          description: invoice.description || '',
          date: invoice.created ? new Date(invoice.created).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }) : new Date().toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          status: invoice.status,
          totalCdf: invoice.totalCdf || 0,
          totalUsd: invoice.totalUsd || 0,
          amountPaidCdf: invoice.amountPaidCdf ?? invoice.totalAfterReductionCdf ?? invoice.totalCdf ?? 0,
          amountPaidUsd: invoice.amountPaidUsd ?? invoice.totalAfterReductionUsd ?? invoice.totalUsd ?? ((invoice.amountPaidCdf ?? invoice.totalAfterReductionCdf ?? invoice.totalCdf ?? 0) / (exchangeRate || 1)),
          reductionCdf: invoice.reductionCdf || 0,
          reductionUsd: invoice.reductionUsd || 0,
          items: invoice.ventes || [],
          tableId: invoice.tableId,
          tableNomination: invoice.tableNomination,
          userId: invoice.userId,
          userName: invoice.userName,
          createdAt: invoice.createdAt || invoice.created || invoice.dateCreated || invoice.creationDate,
          updatedAt: invoice.updatedAt || invoice.updated || invoice.dateUpdated || invoice.updateDate,
          typePaiement: invoice.typePaiement ?? invoice.paymentType ?? null,
          dette: typeof invoice.dette === 'boolean' ? invoice.dette : Boolean(invoice.isDebt),
        }));
        
        setInvoices(transformedInvoices);
      } else {
        setInvoices([]);
      }
      
      return response;
    } catch (error) {
      console.error('🔍 Error in fetchInvoicesByDateRange:', error);
      setInvoicesError(error);
      setInvoices([]);
      throw error;
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Refetch function for manual refresh
  const refetchInvoices = async () => {
    try {
      await fetchInvoicesByDateRange(startDate, endDate);
    } catch (error) {
      console.error('Error refetching invoices:', error);
    }
  };

  // Fetch data when component mounts or date range changes
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const response = await fetchInvoicesByDateRange(startDate, endDate);
        if (response && Array.isArray(response)) {
          setInvoices(response);
        }
      } catch (error) {
        console.error('Error loading invoices:', error);
      }
    };
    
    loadInvoices();
  }, [startDate, endDate]);

  // Helper functions for date formatting
  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDateRangeChange = (newStartDate: Date, newEndDate: Date) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    setCustomDateRange(true);
  };

  const resetToDefaultDateRange = () => {
    const today = new Date();
    today.setHours(1, 0, 0, 0);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(13, 0, 0, 0);
    setStartDate(today);
    setEndDate(tomorrow);
    setCustomDateRange(false);
    // Update text inputs
    setStartDateText(formatDateForDisplay(today));
    setEndDateText(formatDateForDisplay(tomorrow));
  };

  // Initialize text inputs when component mounts
  useEffect(() => {
    setStartDateText(formatDateForDisplay(startDate));
    setEndDateText(formatDateForDisplay(endDate));
  }, []);

  // Parse date from text input
  const parseDateFromText = (dateText: string): Date | null => {
    try {
      // Try different date formats
      const formats = [
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})/, // DD/MM/YYYY HH:MM
        /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{1,2})/, // DD-MM-YYYY HH:MM
        /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})/, // YYYY-MM-DD HH:MM
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
        /^(\d{1,2})-(\d{1,2})-(\d{4})/, // DD-MM-YYYY
        /^(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      ];

      for (const format of formats) {
        const match = dateText.match(format);
        if (match) {
          let day, month, year, hours = 0, minutes = 0;
          
          if (format.source.includes('YYYY')) {
            // YYYY-MM-DD format
            year = parseInt(match[1]);
            month = parseInt(match[2]) - 1; // JavaScript months are 0-based
            day = parseInt(match[3]);
            if (match[4] && match[5]) {
              hours = parseInt(match[4]);
              minutes = parseInt(match[5]);
            }
          } else {
            // DD/MM/YYYY or DD-MM-YYYY format
            day = parseInt(match[1]);
            month = parseInt(match[2]) - 1; // JavaScript months are 0-based
            year = parseInt(match[3]);
            if (match[4] && match[5]) {
              hours = parseInt(match[4]);
              minutes = parseInt(match[5]);
            }
          }

          const date = new Date(year, month, day, hours, minutes);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      // Try parsing as ISO string
      const isoDate = new Date(dateText);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing date:', error);
      return null;
    }
  };

  // Handle start date text change
  const handleStartDateTextChange = (text: string) => {
    setStartDateText(text);
    const parsedDate = parseDateFromText(text);
    if (parsedDate) {
      setStartDate(parsedDate);
    }
  };

  // Handle end date text change
  const handleEndDateTextChange = (text: string) => {
    setEndDateText(text);
    const parsedDate = parseDateFromText(text);
    if (parsedDate) {
      setEndDate(parsedDate);
    }
  };

  // Handle start date text blur
  const handleStartDateTextBlur = () => {
    setIsEditingStartDate(false);
    const parsedDate = parseDateFromText(startDateText);
    if (parsedDate) {
      setStartDate(parsedDate);
      setStartDateText(formatDateForDisplay(parsedDate));
    } else {
      // Reset to current start date if parsing failed
      setStartDateText(formatDateForDisplay(startDate));
    }
  };

  // Handle end date text blur
  const handleEndDateTextBlur = () => {
    setIsEditingEndDate(false);
    const parsedDate = parseDateFromText(endDateText);
    if (parsedDate) {
      setEndDate(parsedDate);
      setEndDateText(formatDateForDisplay(parsedDate));
    } else {
      // Reset to current end date if parsing failed
      setEndDateText(formatDateForDisplay(endDate));
    }
  };

  // Fonctions pour gérer la sélection des dates via le calendrier (web uniquement)
  const handleStartDateSelect = (selectedDate: Date) => {
    setStartDate(selectedDate);
    setStartDateText(formatDateForDisplay(selectedDate));
    setShowStartDateModal(false);
  };

  const handleEndDateSelect = (selectedDate: Date) => {
    setEndDate(selectedDate);
    setEndDateText(formatDateForDisplay(selectedDate));
    setShowEndDateModal(false);
  };

  // Fonctions pour gérer la sélection des dates via le calendrier mobile
  const handleMobileStartDateSelect = (selectedDate: Date) => {
    setStartDate(selectedDate);
    setStartDateText(formatDateForDisplay(selectedDate));
    setShowMobileStartDateModal(false);
  };

  const handleMobileEndDateSelect = (selectedDate: Date) => {
    setEndDate(selectedDate);
    setEndDateText(formatDateForDisplay(selectedDate));
    setShowMobileEndDateModal(false);
  };

  // Debug component to show current state
  const DebugInfo = () => (
    <View style={{ padding: 10, backgroundColor: '#f0f0f0', margin: 10, borderRadius: 5 }}>
      <Text style={{ fontSize: 12, fontWeight: 'bold' }}>Debug Info:</Text>
      <Text style={{ fontSize: 10 }}>Loading: {invoicesLoading ? 'Yes' : 'No'}</Text>
      <Text style={{ fontSize: 10 }}>Error: {invoicesError ? 'Yes' : 'No'}</Text>
      <Text style={{ fontSize: 10 }}>Invoices Count: {invoices.length}</Text>
      <Text style={{ fontSize: 10 }}>Start Date: {startDate.toISOString()}</Text>
      <Text style={{ fontSize: 10 }}>End Date: {endDate.toISOString()}</Text>
    </View>
  );

  // Process API data when invoices are loaded
  useEffect(() => {
    if (invoices && Array.isArray(invoices)) {
      // Debug: Log the first invoice to see the actual structure
      if (invoices && invoices.length > 0) {
      }
      
      // Notifier le composant parent du nombre de factures
      if (onInvoiceCountChange) {
        onInvoiceCountChange(invoices.length);
      }
    }
  }, [invoices, onInvoiceCountChange]);

  useEffect(() => {
    if (!selectedInvoiceForDetails) {
      return;
    }
    const updatedInvoice = invoices.find(inv => inv.id === selectedInvoiceForDetails.id);
    if (updatedInvoice && updatedInvoice !== selectedInvoiceForDetails) {
      setSelectedInvoiceForDetails(updatedInvoice);
      if (selectedInvoice && selectedInvoice.id === updatedInvoice.id) {
        setSelectedInvoice(updatedInvoice);
      }
      if (selectedInvoiceForMobileEdit && selectedInvoiceForMobileEdit.id === updatedInvoice.id) {
        setSelectedInvoiceForMobileEdit(updatedInvoice);
      }
    }
  }, [invoices, selectedInvoiceForDetails, selectedInvoice, selectedInvoiceForMobileEdit]);

  useEffect(() => {
    if (showPaymentsModal && selectedInvoiceForDetails?.id) {
      fetchPayments(selectedInvoiceForDetails.id);
    }
  }, [showPaymentsModal, selectedInvoiceForDetails?.id]);

  // Récupération du taux de change
  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const rate = await getExchangeRate();
        setExchangeRate(rate);
      } catch (error) {
        console.error('Erreur lors de la récupération du taux:', error);
        // Garder la valeur par défaut
      }
    };
    fetchExchangeRate();
  }, []);

  // Traitement des données des catégories
  useEffect(() => {
    if (apiCategories && Array.isArray(apiCategories)) {
      const transformedCategories = (apiCategories as any[]).map((category: any) => ({
        id: category.id,
        name: category.categoryName || category.name || category.nom || 'Catégorie',
        description: category.description || ''
      }));
      setCategories(transformedCategories);
    }
  }, [apiCategories]);

  // Traitement des données des produits
  useEffect(() => {
    if (apiProducts && Array.isArray(apiProducts)) {
      const transformedProducts = (apiProducts as any[]).map((product: any) => ({
        id: product.id,
        name: product.productName || product.name || product.nom || 'Produit',
        category: product.categoryName || product.category?.name || product.category?.categoryName || 'Général',
        price: product.priceUsd || product.price || 0,
        priceUsd: product.priceUsd || product.price || 0,
        priceCdf: product.priceCdf || (product.priceUsd || product.price || 0) * exchangeRate,
        stock: product.inStock || product.stock || product.quantity || product.qte || 0,
        description: product.description || '',
        image: product.image || null
      }));
      setProducts(transformedProducts);
    }
  }, [apiProducts, exchangeRate]);

  useEffect(() => {
    if (apiTables && Array.isArray(apiTables)) {
      const transformedTables = (apiTables as any[])
        .map((table: any) => {
          const value = table.id != null ? String(table.id) : table.tableId != null ? String(table.tableId) : null;
          const label = table.nomination || table.name || table.designation || (value ? `Table ${value}` : null);
          if (!value || !label) {
            return null;
          }
          return {
            value,
            label,
          };
        })
        .filter((table: any) => table !== null);
      const sortedTables = [...transformedTables].sort((a: any, b: any) => {
        const valueA = Number(a.value);
        const valueB = Number(b.value);
        const bothNumeric = !isNaN(valueA) && !isNaN(valueB);
        if (bothNumeric) {
          return valueA - valueB;
        }
        return (a.label || '').localeCompare(b.label || '', 'fr', { numeric: true, sensitivity: 'base' });
      });
      setTables(sortedTables);
    }
  }, [apiTables]);


  // Fonctions utilitaires pour les statuts
  const getStatusColor = (status: number | string) => {
    // Gérer les statuts numériques de l'API
    if (typeof status === 'number') {
      switch (status) {
        case 0: return '#F59E0B'; // En cours
        case 1: return '#10B981'; // Terminé
        case 2: return '#6B7280'; // En pause
        default: return '#6B7280';
      }
    }
    // Gérer les statuts textuels (pour compatibilité)
    switch (status) {
      case 'en cours': return '#F59E0B';
      case 'terminé': return '#10B981';
      case 'en pause': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: number | string) => {
    // Gérer les statuts numériques de l'API
    if (typeof status === 'number') {
      switch (status) {
        case 0: return 'Proformat status facture (0)';
        case 1: return 'Payé status facture (1)';
        case 2: return 'Annulé status facture (2)';
        default: return 'Inconnu';
      }
    }
    // Gérer les statuts textuels (pour compatibilité)
    switch (status) {
      case 'en cours': return 'Proformat status facture (0)';
      case 'terminé': return 'Payé status facture (1)';
      case 'en pause': return 'Annulé status facture (2)';
      default: return status;
    }
  };

  const selectedTableData = selectedTable === 'Toutes' ? null : tables.find((table: any) => table.value === selectedTable);

  // Filtrage des factures
  const filteredInvoices = invoices.filter((invoice: Invoice) => {
    let matchesStatus = true;

    if (selectedStatus === 'Payées') {
      matchesStatus = invoice.status === 1;
    } else if (selectedStatus === 'Non payées') {
      matchesStatus = invoice.status !== 1;
    }

    let matchesTable = true;
    if (selectedTable !== 'Toutes') {
      const tableIdMatch = invoice.tableId != null && invoice.tableId.toString() === selectedTable;
      const tableNameMatch =
        !!selectedTableData?.label &&
        !!invoice.tableNomination &&
        invoice.tableNomination.toLowerCase() === selectedTableData.label.toLowerCase();
      matchesTable = tableIdMatch || tableNameMatch;
    }

    const matchesSearch =
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.tableNomination && invoice.tableNomination.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesTable && matchesSearch;
  });

  // Catégories disponibles (depuis l'API + "Toutes")
  const productCategories = ['Toutes', ...categories.map((cat: any) => cat.name)];
  
  const buildInvoiceReportStats = (invoicesToAnalyse: Invoice[]) => {
    return invoicesToAnalyse.reduce(
      (acc, invoice) => {
        const totalCdf = Number(invoice.amountPaidCdf ?? invoice.totalCdf ?? 0);
        const totalUsd = Number(invoice.amountPaidUsd ?? invoice.totalUsd ?? (totalCdf / (exchangeRate || 1)));

        acc.totalCdf += totalCdf;
        acc.totalUsd += totalUsd;
        acc.count += 1;

        if (invoice.status === 1) {
          acc.paid += 1;
        } else if (invoice.status === 0) {
          acc.proformat += 1;
        } else if (invoice.status === 2) {
          acc.cancelled += 1;
        }

        if (invoice.dette) {
          acc.debt += 1;
        }

        return acc;
      },
      {
        count: 0,
        totalCdf: 0,
        totalUsd: 0,
        paid: 0,
        proformat: 0,
        cancelled: 0,
        debt: 0,
      },
    );
  };

  const generateInvoiceReportHTML = (invoicesToUse: Invoice[], title: string) => {
    const stats = buildInvoiceReportStats(invoicesToUse);
    const nowLabel = new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
    const periodLabel = `${formatDateForDisplay(startDate)} ➜ ${formatDateForDisplay(endDate)}`;

    const rowsHTML = invoicesToUse
      .map((invoice, index) => {
        const invoiceDateSource = invoice.createdAt || invoice.updatedAt || invoice.date;
        const parsedDate = invoiceDateSource ? new Date(invoiceDateSource) : new Date();
        const rowDate = `${parsedDate.toLocaleDateString('fr-FR')} ${parsedDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })}`;
        const totalCdf = Number(invoice.amountPaidCdf ?? invoice.totalCdf ?? 0);
        const totalUsd = Number(invoice.amountPaidUsd ?? invoice.totalUsd ?? (totalCdf / (exchangeRate || 1)));
        const tableLabel = invoice.tableNomination || (invoice.tableId ? `Table ${invoice.tableId}` : 'N/A');
        const statusLabel = getStatusLabel(invoice.status);
        const paymentType = invoice.typePaiement || 'Non défini';
        const itemsCount = invoice.items?.length || 0;

        let ventesRows = '';
        if (invoice.items && invoice.items.length > 0) {
          const ventesTableRows = invoice.items
            .map((item: any) => {
              const quantity = Number(item.qte ?? item.quantity ?? 1);
              const unitPriceCdf =
                item.priceCdf != null
                  ? Number(item.priceCdf)
                  : quantity > 0
                  ? Number(item.subTotalCdf ?? 0) / quantity
                  : 0;
              const unitPriceUsd =
                item.priceUsd != null
                  ? Number(item.priceUsd)
                  : quantity > 0
                  ? Number(item.subTotalUsd ?? 0) / quantity
                  : 0;
              const totalItemCdf =
                item.subTotalCdf != null
                  ? Number(item.subTotalCdf)
                  : unitPriceCdf * quantity;
              const totalItemUsd =
                item.subTotalUsd != null
                  ? Number(item.subTotalUsd)
                  : unitPriceUsd * quantity;

              const createdRaw = item.created || item.updated;
              const createdDate = createdRaw ? new Date(createdRaw) : null;
              const createdLabel = createdDate
                ? `${createdDate.toLocaleDateString('fr-FR')} ${createdDate.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : '—';

              return `
                <tr>
                  <td style="border: 1px solid #E2E8F0; padding: 8px;">${item.productName || item.name || 'Produit'}</td>
                  <td style="border: 1px solid #E2E8F0; padding: 8px; text-align: center;">${quantity}</td>
                  <td style="border: 1px solid #E2E8F0; padding: 8px; text-align: right;">${unitPriceCdf.toLocaleString('fr-FR')} CDF</td>
                  <td style="border: 1px solid #E2E8F0; padding: 8px; text-align: right;">$${unitPriceUsd.toFixed(2)}</td>
                  <td style="border: 1px solid #E2E8F0; padding: 8px; text-align: right;">${totalItemCdf.toLocaleString('fr-FR')} CDF</td>
                  <td style="border: 1px solid #E2E8F0; padding: 8px; text-align: right;">$${totalItemUsd.toFixed(2)}</td>
                  <td style="border: 1px solid #E2E8F0; padding: 8px;">${createdLabel}</td>
                </tr>
              `;
            })
            .join('');

          ventesRows = `
            <tr>
              <td colspan="12" style="background-color: #F8FAFC; padding: 0;">
                <div style="padding: 16px 20px;">
                  <div style="font-weight: 600; color: #4338CA; margin-bottom: 12px; font-size: 14px;">
                    Articles (${invoice.items.length})
                  </div>
                  <table style="width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden;">
                    <thead>
                      <tr style="background-color: #EEF2FF; color: #ffffff;">
                        <th style="border: 1px solid #E2E8F0; padding: 8px; text-align: left;">Produit</th>
                        <th style="border: 1px solid #E2E8F0; padding: 8px; text-align: center;">Quantité</th>
                        <th style="border: 1px solid #E2E8F0; padding: 8px; text-align: right;">Prix unit. CDF</th>
                        <th style="border: 1px solid #E2E8F0; padding: 8px; text-align: right;">Prix unit. USD</th>
                        <th style="border: 1px solid #E2E8F0; padding: 8px; text-align: right;">Sous-total CDF</th>
                        <th style="border: 1px solid #E2E8F0; padding: 8px; text-align: right;">Sous-total USD</th>
                        <th style="border: 1px solid #E2E8F0; padding: 8px; text-align: left;">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${ventesTableRows}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          `;
        }

        return `
          <tr>
            <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: center; font-weight: 600; color: #334155;">${index + 1}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px; font-weight: 600; color: #1E293B;">${invoice.id || 'N/A'}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px;">${invoice.customerName || 'Client anonyme'}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px;">${tableLabel}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: center;">${itemsCount}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right; font-weight: 600;">${totalCdf.toLocaleString('fr-FR')} CDF</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px; text-align: right;">$${totalUsd.toFixed(2)}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px;">${statusLabel}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px;">${invoice.dette ? 'Oui' : 'Non'}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px;">${paymentType}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px;">${invoice.userName || '—'}</td>
            <td style="border: 1px solid #E2E8F0; padding: 10px;">${rowDate}</td>
          </tr>
          ${ventesRows}
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              font-family: 'Segoe UI', Arial, sans-serif;
              background-color: #F8FAFC;
              color: #0F172A;
            }
            h1 {
              margin: 0 0 6px 0;
              font-size: 28px;
              color: #111827;
            }
            h2 {
              margin: 32px 0 12px 0;
              font-size: 20px;
              color: #1F2937;
            }
            .meta {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              margin-bottom: 24px;
              font-size: 14px;
              color: #475569;
            }
            .meta span {
              padding: 6px 12px;
              border-radius: 999px;
              background-color: #E2E8F0;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
              gap: 16px;
              margin-bottom: 24px;
            }
            .summary-card {
              padding: 16px;
              border-radius: 12px;
              background: linear-gradient(135deg, #EEF2FF, #E0E7FF);
              border: 1px solid #C7D2FE;
              box-shadow: 0 10px 25px rgba(79, 70, 229, 0.1);
            }
            .summary-card h3 {
              margin: 0;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              color: #4338CA;
            }
            .summary-card p {
              margin: 8px 0 0 0;
              font-size: 20px;
              font-weight: 700;
              color: #1E293B;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              background-color: #FFFFFF;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
            }
            thead tr {
              background: linear-gradient(135deg, #4C1D95, #7C3AED);
              color: #FFFFFF;
            }
            thead th {
              border: 1px solid rgba(255,255,255,0.12);
              padding: 14px 10px;
              font-size: 13px;
              letter-spacing: 0.04em;
            }
            tbody tr:nth-child(even) {
              background-color: #F5F3FF;
            }
            tbody td {
              font-size: 13px;
              color: #1F2937;
            }
            tfoot td {
              padding: 14px 10px;
              background-color: #EEF2FF;
              border: 1px solid #C7D2FE;
              font-weight: 600;
            }
            .footer {
              margin-top: 32px;
              font-size: 12px;
              color: #64748B;
              text-align: right;
            }
            @media print {
              body { padding: 0; }
              .summary-card { box-shadow: none; background: #E0E7FF !important; }
              table { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <header>
            <h1>${title}</h1>
            <div class="meta">
              <span>Période : ${periodLabel}</span>
              <span>Total factures : ${stats.count}</span>
              <span>Payées : ${stats.paid}</span>
              <span>Proformats : ${stats.proformat}</span>
              <span>Annulées : ${stats.cancelled}</span>
              <span>Dettes : ${stats.debt}</span>
              <span>Généré le : ${nowLabel}</span>
            </div>
          </header>
          <section class="summary-grid">
            <div class="summary-card">
              <h3>Total CDF</h3>
              <p>${stats.totalCdf.toLocaleString('fr-FR')} CDF</p>
            </div>
            <div class="summary-card">
              <h3>Total USD</h3>
              <p>$${stats.totalUsd.toFixed(2)}</p>
            </div>
            <div class="summary-card">
              <h3>Factures payées</h3>
              <p>${stats.paid}</p>
            </div>
            <div class="summary-card">
              <h3>Factures en dette</h3>
              <p>${stats.debt}</p>
            </div>
          </section>
          <h2>Détail des factures</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ID Facture</th>
                <th>Client</th>
                <th>Table</th>
                <th>Articles</th>
                <th>Total (CDF)</th>
                <th>Total (USD)</th>
                <th>Statut</th>
                <th>Dette</th>
                <th>Paiement</th>
                <th>Responsable</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHTML}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5">Totaux</td>
                <td style="text-align: right;">${stats.totalCdf.toLocaleString('fr-FR')} CDF</td>
                <td style="text-align: right;">$${stats.totalUsd.toFixed(2)}</td>
                <td colspan="5"></td>
              </tr>
            </tfoot>
          </table>
          <div class="footer">
            Rapport généré depuis Restaurent Manager IO - ${nowLabel}
          </div>
        </body>
      </html>
    `;
  };

  const handlePrintInvoiceReport = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Information', 'L\'impression PDF est disponible depuis la version web.');
      return;
    }

    const iframeWindow = invoiceReportIframeRef.current?.contentWindow;
    if (iframeWindow) {
      iframeWindow.focus();
      iframeWindow.print();
    }
  };

  const closeInvoiceReportModal = () => {
    setShowInvoiceReportModal(false);
    setInvoiceReportHtml('');
    setInvoiceReportData([]);
    setPendingInvoiceAutoPrint(false);
  };

  const handleInvoiceReportIframeLoad = () => {
    if (Platform.OS !== 'web') return;
    if (pendingInvoiceAutoPrint) {
      setTimeout(() => {
        handlePrintInvoiceReport();
        setPendingInvoiceAutoPrint(false);
      }, 150);
    }
  };

  const handleOpenInvoiceReport = (options?: { autoPrint?: boolean }) => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      Alert.alert('Information', 'Aucune facture ne correspond aux critères sélectionnés.');
      return;
    }

    const title = `Rapport des factures (${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)})`;
    setInvoiceReportTitle(title);
    setInvoiceReportData([...filteredInvoices]);

    if (Platform.OS === 'web') {
      const html = generateInvoiceReportHTML(filteredInvoices, title);
      setInvoiceReportHtml(html);
      if (options?.autoPrint) {
        setPendingInvoiceAutoPrint(true);
      } else {
        setPendingInvoiceAutoPrint(false);
      }
    } else {
      setInvoiceReportHtml('');
      setPendingInvoiceAutoPrint(false);
    }

    setShowInvoiceReportModal(true);
  };

  const renderInvoiceReportModal = () => {
    if (!showInvoiceReportModal) {
      return null;
    }

    return (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={closeInvoiceReportModal}
        />
        <View style={styles.invoiceReportModalContainer}>
          <View style={styles.invoiceReportHeader}>
          <View style={styles.invoiceReportHeaderActions}>
          <TouchableOpacity style={styles.closeButton} onPress={closeInvoiceReportModal}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
              {Platform.OS === 'web' && invoiceReportHtml !== '' && (
                <TouchableOpacity
                  style={styles.invoiceReportPrintButton}
                  onPress={handlePrintInvoiceReport}
                >
                  <Ionicons name="print" size={18} color="#FFFFFF" />
                  <Text style={styles.invoiceReportPrintButtonText}>Imprimer</Text>
                </TouchableOpacity>
              )}
              
            </View>
            <View>
              <Text style={styles.invoiceReportTitle}>{invoiceReportTitle}</Text>
              <Text style={styles.invoiceReportSubtitle}>
                Période : {formatDateForDisplay(startDate)} ➜ {formatDateForDisplay(endDate)}
              </Text>
            </View>
            
          </View>
          <View style={styles.invoiceReportBody}>
            {Platform.OS === 'web' ? (
              <View style={styles.invoiceReportIframeContainer}>
                {invoiceReportHtml ? (
                  React.createElement('iframe', {
                    srcDoc: invoiceReportHtml,
                    style: {
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderRadius: 12,
                    },
                    ref: invoiceReportIframeRef,
                    onLoad: handleInvoiceReportIframeLoad,
                  } as any)
                ) : (
                  <View style={styles.invoiceReportEmptyState}>
                    <Ionicons name="copy-outline" size={36} color="#9CA3AF" />
                    <Text style={styles.invoiceReportEmptyText}>Prévisualisation indisponible.</Text>
                  </View>
                )}
              </View>
            ) : (
              <ScrollView
                style={styles.invoiceReportScroll}
                contentContainerStyle={styles.invoiceReportScrollContent}
              >
                {invoiceReportData.length > 0 ? (
                  <>
                    {(() => {
                      const stats = buildInvoiceReportStats(invoiceReportData);
                      return (
                        <View style={styles.invoiceReportStatsMobileGrid}>
                          <View style={styles.invoiceReportStatsMobileCard}>
                            <Text style={styles.invoiceReportStatsMobileLabel}>Total CDF</Text>
                            <Text style={styles.invoiceReportStatsMobileValue}>
                              {stats.totalCdf.toFixed(0)} CDF
                            </Text>
                          </View>
                          <View style={styles.invoiceReportStatsMobileCard}>
                            <Text style={styles.invoiceReportStatsMobileLabel}>Total USD</Text>
                            <Text style={styles.invoiceReportStatsMobileValue}>
                              ${stats.totalUsd.toFixed(2)}
                            </Text>
                          </View>
                          <View style={styles.invoiceReportStatsMobileCard}>
                            <Text style={styles.invoiceReportStatsMobileLabel}>Factures</Text>
                            <Text style={styles.invoiceReportStatsMobileValue}>{stats.count}</Text>
                          </View>
                          <View style={styles.invoiceReportStatsMobileCard}>
                            <Text style={styles.invoiceReportStatsMobileLabel}>Dettes</Text>
                            <Text style={styles.invoiceReportStatsMobileValue}>{stats.debt}</Text>
                          </View>
                        </View>
                      );
                    })()}
                    <View style={styles.invoiceReportListMobile}>
                      {invoiceReportData.map((invoice, index) => {
                        const totalCdf = Number(
                          invoice.amountPaidCdf ?? invoice.totalCdf ?? 0,
                        );
                        const totalUsd = Number(
                          invoice.amountPaidUsd ??
                            invoice.totalUsd ??
                            (exchangeRate ? totalCdf / exchangeRate : 0),
                        );
                        const rawDate = invoice.createdAt || invoice.updatedAt || invoice.date;
                        const parsedDate = rawDate ? new Date(rawDate) : new Date();
                        const formattedDate = `${parsedDate.toLocaleDateString('fr-FR')} ${parsedDate.toLocaleTimeString(
                          'fr-FR',
                          { hour: '2-digit', minute: '2-digit' },
                        )}`;

                        return (
                          <View key={`${invoice.id}-${index}`} style={styles.invoiceReportItemMobile}>
                            <View style={styles.invoiceReportItemHeaderMobile}>
                              <Text style={styles.invoiceReportItemTitleMobile}>
                                {invoice.customerName || 'Client anonyme'}
                              </Text>
                              <View style={styles.invoiceReportBadgeMobile}>
                                <Text style={styles.invoiceReportBadgeTextMobile}>
                                  {getStatusLabel(invoice.status)}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.invoiceReportItemRowMobile}>
                              <Text style={styles.invoiceReportItemLabelMobile}>Facture</Text>
                              <Text style={styles.invoiceReportItemValueMobile}>
                                {invoice.id || 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.invoiceReportItemRowMobile}>
                              <Text style={styles.invoiceReportItemLabelMobile}>Total</Text>
                              <Text style={styles.invoiceReportItemValueMobile}>
                                {totalCdf.toFixed(0)} CDF / ${totalUsd.toFixed(2)}
                              </Text>
                            </View>
                            <View style={styles.invoiceReportItemRowMobile}>
                              <Text style={styles.invoiceReportItemLabelMobile}>Table</Text>
                              <Text style={styles.invoiceReportItemValueMobile}>
                                {invoice.tableNomination || invoice.tableId || 'N/A'}
                              </Text>
                            </View>
                            <View style={styles.invoiceReportItemRowMobile}>
                              <Text style={styles.invoiceReportItemLabelMobile}>Paiement</Text>
                              <Text style={styles.invoiceReportItemValueMobile}>
                                {invoice.typePaiement || 'Non défini'}
                              </Text>
                            </View>
                            <View style={styles.invoiceReportItemRowMobile}>
                              <Text style={styles.invoiceReportItemLabelMobile}>Dette</Text>
                              <Text style={styles.invoiceReportItemValueMobile}>
                                {invoice.dette ? 'Oui' : 'Non'}
                              </Text>
                            </View>
                            <View style={styles.invoiceReportItemRowMobile}>
                              <Text style={styles.invoiceReportItemLabelMobile}>Responsable</Text>
                              <Text style={styles.invoiceReportItemValueMobile}>
                                {invoice.userName || '—'}
                              </Text>
                            </View>
                            <View style={styles.invoiceReportItemRowMobile}>
                              <Text style={styles.invoiceReportItemLabelMobile}>Date</Text>
                              <Text style={styles.invoiceReportItemValueMobile}>{formattedDate}</Text>
                            </View>
                            {invoice.items && invoice.items.length > 0 && (
                              <View style={styles.invoiceReportProductsMobile}>
                                <Text style={styles.invoiceReportProductsTitleMobile}>
                                  Articles ({invoice.items.length})
                                </Text>
                                {invoice.items.map((item: any, itemIdx: number) => {
                                  const quantity = Number(item.qte ?? item.quantity ?? 1);
                                  const totalCdf =
                                    item.subTotalCdf != null
                                      ? Number(item.subTotalCdf)
                                      : Number(item.priceCdf ?? 0) * quantity;
                                  const totalUsd =
                                    item.subTotalUsd != null
                                      ? Number(item.subTotalUsd)
                                      : Number(item.priceUsd ?? 0) * quantity;
                                  return (
                                    <View key={`${invoice.id}-item-${itemIdx}`} style={styles.invoiceReportProductRowMobile}>
                                      <View style={styles.invoiceReportProductHeaderMobile}>
                                        <Text style={styles.invoiceReportProductNameMobile}>
                                          {item.productName || item.name || 'Produit'}
                                        </Text>
                                        <Text style={styles.invoiceReportProductQtyMobile}>
                                          x{quantity}
                                        </Text>
                                      </View>
                                      <View style={styles.invoiceReportProductAmountsMobile}>
                                        <Text style={styles.invoiceReportProductAmountMobile}>
                                          {totalCdf.toFixed(0)} CDF
                                        </Text>
                                        <Text style={styles.invoiceReportProductAmountSecondaryMobile}>
                                          ${totalUsd.toFixed(2)}
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={styles.invoiceReportEmptyState}>
                    <Ionicons name="document-outline" size={36} color="#9CA3AF" />
                    <Text style={styles.invoiceReportEmptyText}>
                      Aucune facture à afficher pour cette période.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
          {Platform.OS !== 'web' && (
            <View style={styles.invoiceReportMobileFooter}>
              <TouchableOpacity
                style={styles.closeButtonMobile}
                onPress={closeInvoiceReportModal}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
                <Text style={styles.closeButtonMobileText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Produits filtrés par catégorie
  const filteredProducts = products.filter((product: any) => {
    if (selectedProductCategory === 'Toutes') return true;
    return product.category === selectedProductCategory;
  });

  // Debug logs

  // Fonctions pour la modal (Mobile uniquement)
  const openInvoiceModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setSelectedInvoiceForMobileEdit(invoice); // Initialiser pour la modification mobile
    setSelectedInvoiceForDetails(invoice);
    setActiveMobileModalTab('details'); // Réinitialiser l'onglet actif
    if (isLargeScreen) {
      setShowInvoiceModal(true);
    }
    setActiveModalTab('details');
  };

  const closeInvoiceModal = () => {
    setShowInvoiceModal(false);
    setSelectedInvoice(null);
    setSelectedInvoiceForMobileEdit(null); // Réinitialiser les données de modification mobile
    setActiveMobileModalTab('details'); // Réinitialiser l'onglet actif
  };

  const applyInvoiceUpdates = (updates: Partial<Invoice>) => {
    const targetId = selectedInvoice?.id || selectedInvoiceForDetails?.id;

    setSelectedInvoice((prev: any) => (prev ? { ...prev, ...updates } : prev));
    setSelectedInvoiceForDetails((prev: any) => (prev ? { ...prev, ...updates } : prev));

    if (targetId) {
      setInvoices(prevInvoices =>
        prevInvoices.map(inv => (inv.id === targetId ? { ...inv, ...updates } : inv))
      );
    }
  };

  const handleMobilePaymentMethodChange = (method: string) => {
    applyInvoiceUpdates({ typePaiement: method });
  };

  const handleMobileDebtToggle = (value: boolean) => {
    applyInvoiceUpdates({ dette: value });
  };

  // Fonction pour sélectionner une facture pour la section droite (Web)
  const selectInvoiceForDetails = (invoice: any) => {
    setSelectedInvoiceForDetails(invoice);
    setActiveDetailsTab('edit');
  };

  // Fonction pour imprimer une facture
  const handlePrintFacture = async () => {
    if (!selectedInvoiceForDetails) return;
    
    setIsPrinting(true);
    try {
      const receiptData = formatInvoiceForReceipt(selectedInvoiceForDetails);
      await printFacture(receiptData);
      Alert.alert('Succès', 'Facture envoyée à l\'imprimante avec succès!');
      setShowPrintModal(false);
    } catch (error) {
      console.error('Erreur lors de l\'impression:', error);
      
      // Gestion des erreurs spécifiques
      let errorMessage = 'Impossible d\'imprimer la facture.';
      
      Alert.alert('Erreur d\'impression', errorMessage);
    } finally {
      setIsPrinting(false);
    }
  };

  // Fonction pour imprimer la facture mobile avec les données modifiées
  // Fonction pour afficher l'alerte de confirmation avant l'impression mobile
  const showMobilePrintConfirmation = () => {
    if (!selectedInvoiceForDetails) return;

    // Sur mobile, utiliser editableItems pour les calculs, sinon utiliser selectedInvoiceForDetails.items
    const itemsForCalculation = !isLargeScreen && editableItems.length > 0 ? editableItems : selectedInvoiceForDetails.items;
    const totalItems = itemsForCalculation.length;
    const totalCdf = itemsForCalculation.reduce((sum: number, item: any) => 
      sum + (item.subTotalCdf || item.priceCdf * (item.qte || item.quantity) || 0), 0
    );
    const totalUsd = totalCdf / exchangeRate;
    const totalAfterReductionCdf = totalCdf - (selectedInvoiceForDetails.reductionCdf || 0);
    const totalAfterReductionUsd = totalUsd - (selectedInvoiceForDetails.reductionUsd || 0);

    // Ajouter des informations sur les modifications si on est sur mobile
    const modificationInfo = !isLargeScreen && editableItems.length > 0 ? 
      `\n📱 MODIFICATIONS APPORTÉES :
🛒 Articles modifiés: ${editableItems.length} article(s)
💰 Nouveau total CDF: ${totalCdf.toFixed(0)} CDF
💰 Nouveau total USD: ${totalUsd.toFixed(2)} USD
✅ Nouveau total après réduction: ${totalAfterReductionCdf.toFixed(0)} CDF / ${totalAfterReductionUsd.toFixed(2)} USD` : '';

    const confirmationMessage = `Détails de la facture à imprimer :

📋 ID: ${selectedInvoiceForDetails.id}
👤 Client: ${selectedInvoiceForDetails.customerName}
📝 Description: ${selectedInvoiceForDetails.description || 'Aucune'}
🏷️ Table: ${selectedInvoiceForDetails.tableNomination || 'N/A'}
📊 Statut: ${getStatusLabel(selectedInvoiceForDetails.status)}
🛒 Articles: ${totalItems} article(s)
💰 Total CDF: ${totalCdf.toFixed(0)} CDF
💰 Total USD: ${totalUsd.toFixed(2)} USD
🎯 Réduction CDF: ${selectedInvoiceForDetails.reductionCdf || 0} CDF
🎯 Réduction USD: ${selectedInvoiceForDetails.reductionUsd || 0} USD
✅ Total après réduction: ${totalAfterReductionCdf.toFixed(0)} CDF / ${totalAfterReductionUsd.toFixed(2)} USD${modificationInfo}

Voulez-vous confirmer l'impression de cette facture ?`;

    // Utiliser window.confirm sur Web, Alert.alert sur mobile
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(confirmationMessage);
      if (confirmed) {
        handleMobilePrintFacture();
      }
    } else {
      Alert.alert(
        'Confirmation d\'impression',
        confirmationMessage,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Imprimer',
            style: 'default',
            onPress: () => handleMobilePrintFacture(),
          },
        ]
      );
    }
  };

  const handleMobilePrintFacture = async () => {
    if (!selectedInvoiceForDetails) return;
    
    setIsPrinting(true);
    try {
      // Créer un objet facture avec les modifications
      const modifiedInvoice = {
        ...selectedInvoiceForDetails,
        items: editableItems, // Utiliser les articles modifiés
        // Recalculer les totaux avec les modifications
        totalCdf: editableItems.reduce((sum: number, item: any) => 
          sum + (item.subTotalCdf || item.priceCdf * (item.qte || item.quantity) || 0), 0),
        totalUsd: editableItems.reduce((sum: number, item: any) => 
          sum + (item.subTotalUsd || item.priceUsd * (item.qte || item.quantity) || 0), 0),
        amountPaidCdf: editableItems.reduce((sum: number, item: any) => 
          sum + (item.subTotalCdf || item.priceCdf * (item.qte || item.quantity) || 0), 0) - (selectedInvoiceForDetails.reductionCdf || 0),
        amountPaidUsd: editableItems.reduce((sum: number, item: any) => 
          sum + (item.subTotalUsd || item.priceUsd * (item.qte || item.quantity) || 0), 0) - (selectedInvoiceForDetails.reductionUsd || 0)
      };
      
      
      const receiptData = formatInvoiceForReceipt(modifiedInvoice);
      await printFacture(receiptData);
      Alert.alert('Succès', 'Facture modifiée envoyée à l\'imprimante avec succès!');
    } catch (error) {
      console.error('Erreur lors de l\'impression mobile:', error);
      Alert.alert('Erreur d\'impression', 'Impossible d\'imprimer la facture.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePaymentAmountChange = (value: string) => {
    if (paymentDevise === 1) {
      const sanitized = value.replace(',', '.');
      if (sanitized.trim() === '') {
        setPaymentAmount('');
        return;
      }
      if (!/^\d*(\.\d{0,2})?$/.test(sanitized)) {
        return;
      }
      const parsed = Number(sanitized);
      if (!Number.isFinite(parsed)) {
        setPaymentAmount('');
        return;
      }
      if (paymentLimit <= 0) {
        setPaymentAmount('');
        return;
      }
      const clamped = Math.min(parsed, paymentLimit);
      setPaymentAmount(parsed > paymentLimit ? clamped.toFixed(2) : sanitized);
    } else {
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly === '') {
        setPaymentAmount('');
        return;
      }
      const parsed = Number(digitsOnly);
      if (!Number.isFinite(parsed)) {
        setPaymentAmount('');
        return;
      }
      if (paymentLimit <= 0) {
        setPaymentAmount('');
        return;
      }
      const clamped = Math.min(parsed, Math.floor(paymentLimit));
      setPaymentAmount(clamped.toString());
    }
  };

  const handlePaymentDeviseChange = (value: number) => {
    setPaymentDevise(value);
    setPaymentAmount('');
  };

  const fetchPayments = async (factureId: string) => {
    if (!factureId) {
      setPayments([]);
      return;
    }
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const response = await getFacturePayments(factureId);
      const dataCandidate = response?.data ?? response;
      setPayments(Array.isArray(dataCandidate) ? dataCandidate : []);
    } catch (error) {
      console.error('Erreur lors de la récupération des paiements:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible de récupérer les paiements.';
      setPaymentsError(message);
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId?: string) => {
    if (!paymentId) {
      Alert.alert('Erreur', 'Identifiant du paiement invalide.');
      return;
    }

    const confirmMessage = 'Êtes-vous sûr de vouloir supprimer ce paiement ?';

    const executeDeletion = async () => {
      setDeletingPaymentId(paymentId);
      try {
        await deleteFacturePayment(paymentId);
        Alert.alert('Succès', 'Paiement supprimé avec succès.');
        setPayments(prev => prev.filter(payment => payment.id !== paymentId));
        await refetchInvoices();
        if (selectedInvoiceForDetails?.id) {
          await fetchPayments(selectedInvoiceForDetails.id);
        }
      } catch (error) {
        console.error('Erreur lors de la suppression du paiement:', error);
        Alert.alert('Erreur', 'Impossible de supprimer le paiement.');
      } finally {
        setDeletingPaymentId(null);
      }
    };

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (window.confirm(confirmMessage)) {
        executeDeletion();
      }
    } else {
      Alert.alert(
        'Confirmation',
        confirmMessage,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Supprimer', style: 'destructive', onPress: executeDeletion },
        ],
        { cancelable: true }
      );
    }
  };

  const handleOpenPaymentsModal = () => {
    if (!selectedInvoiceForDetails?.id) {
      Alert.alert('Information', 'Veuillez sélectionner une facture pour consulter les paiements.');
      return;
    }
    setShowPaymentsModal(true);
  };

  const handleClosePaymentsModal = () => {
    setShowPaymentsModal(false);
  };

  const resetPaymentForm = () => {
    setPaymentAmount('');
  setPaymentDevise(1);
    setPaymentObservation('');
  };

  const handleAddPayment = async () => {
    if (!selectedInvoiceForDetails?.id) {
      Alert.alert('Erreur', 'Aucune facture sélectionnée pour le paiement.');
      return;
    }

    if (paymentLimit <= 0) {
      Alert.alert('Solde épuisé', 'Aucun montant n\'est dû pour cette devise.');
      return;
    }

    if (!isPaymentAmountPositive) {
      Alert.alert('Montant invalide', 'Veuillez saisir un montant supérieur à zéro.');
      return;
    }

    const numericAmount = paymentAmountNumber;
    const tolerance = paymentDevise === 1 ? 0.01 : 0;
    if (numericAmount - paymentLimit > tolerance) {
      Alert.alert(
        'Montant trop élevé',
        `Le montant saisi dépasse le reste à payer (${paymentDevise === 1 ? paymentLimit.toFixed(2) + ' USD' : `${Math.floor(paymentLimit)} CDF`}).`,
      );
      return;
    }

    const amountToSend =
      paymentDevise === 1 ? Number(numericAmount.toFixed(2)) : Math.round(numericAmount);

    setIsSubmittingPayment(true);
    try {
      const payload = {
        factureId: selectedInvoiceForDetails.id,
        amount: amountToSend,
        devise: paymentDevise,
        taux: exchangeRate,
        observation: paymentObservation.trim(),
      };

      await addFacturePayment(payload);

      Alert.alert('Succès', 'Paiement enregistré avec succès.');
      resetPaymentForm();
      await refetchInvoices();
    } catch (error) {
      console.error('Erreur lors de l\'ajout du paiement:', error);
      const message =
        error instanceof Error ? error.message : 'Impossible d\'enregistrer le paiement.';
      Alert.alert('Erreur', message);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  useEffect(() => {
    if (!paymentAmount) {
      return;
    }
    if (paymentLimit <= 0) {
      setPaymentAmount('');
      return;
    }
    const numericAmount = paymentAmountNumber;
    if (!Number.isFinite(numericAmount)) {
      setPaymentAmount('');
      return;
    }
    if (numericAmount > paymentLimit) {
      const formatted =
        paymentDevise === 1
          ? paymentLimit.toFixed(2)
          : Math.floor(paymentLimit).toString();
      setPaymentAmount(formatted);
    }
  }, [paymentLimit, paymentDevise, paymentAmount, paymentAmountNumber]);

  // Fonction pour changer le statut de la facture
  const toggleInvoiceStatus = () => {
    if (!selectedInvoiceForDetails) return;

    const currentStatus = selectedInvoiceForDetails.status;
    let newStatus: number;
    let actionText: string;
    
    // Gérer les statuts numériques de l'API
    if (typeof currentStatus === 'number') {
      if (currentStatus === 0) {
        newStatus = 1; // En cours -> Terminé
        actionText = 'terminer';
      } else if (currentStatus === 1) {
        newStatus = 0; // Terminé -> En cours
        actionText = 'continuer';
      } else if (currentStatus === 2) {
        newStatus = 0; // En pause -> En cours
        actionText = 'continuer';
      } else {
        newStatus = 0; // Par défaut -> En cours
        actionText = 'continuer';
      }
    } else {
      // Gérer les statuts textuels (pour compatibilité)
      if (currentStatus === 'en cours') {
        newStatus = 1;
        actionText = 'terminer';
      } else {
        newStatus = 0;
        actionText = 'continuer';
      }
    }
    
    const confirmMessage = `Êtes-vous sûr de vouloir ${actionText} la facture ${selectedInvoiceForDetails.id} ?`;
    
    // Fonction pour exécuter le changement de statut
    const executeStatusChange = () => {
      const updatedInvoices: Invoice[] = invoices.map((invoice: Invoice) => {
        if (invoice.id === selectedInvoiceForDetails.id) {
          return { ...invoice, status: newStatus };
        }
        return invoice;
      });

      setInvoices(updatedInvoices);
      const updatedInvoice = updatedInvoices.find((inv: Invoice) => inv.id === selectedInvoiceForDetails.id);
      if (updatedInvoice) {
        setSelectedInvoiceForDetails(updatedInvoice);
      }
      
      // Afficher un message de succès
      const successMessage = `Facture ${selectedInvoiceForDetails.id} ${actionText}ée avec succès !`;
      
      // Utiliser window.confirm sur Web, Alert.alert sur mobile
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        window.alert(successMessage);
      } else {
        Alert.alert('Succès', successMessage);
      }
    };

    // Utiliser window.confirm sur Web, Alert.alert sur mobile
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        executeStatusChange();
      }
    } else {
      Alert.alert(
        'Confirmation',
        confirmMessage,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Confirmer',
            style: 'default',
            onPress: executeStatusChange,
          },
        ]
      );
    }
  };

  const addProductToInvoice = (product: any, quantity: number = 1) => {
    const targetInvoice = selectedInvoice || selectedInvoiceForDetails;
    if (!targetInvoice) return;

    // Avertir si le produit est en rupture de stock mais permettre l'ajout
    if (product.stock === 0 || product.stock < quantity) {
      Alert.alert(
        'Attention - Stock insuffisant',
        `Ce produit est en rupture de stock (Stock: ${product.stock}). Voulez-vous quand même l'ajouter à la facture ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ajouter quand même', style: 'default', onPress: () => proceedWithAddProduct(product, quantity, targetInvoice) }
        ]
      );
      return;
    }

    proceedWithAddProduct(product, quantity, targetInvoice);
  };

  const computePaidTotals = (items: any[], reductionCdf = 0, reductionUsd = 0) => {
    const totals = items.reduce(
      (acc, item: any) => {
        const qty = Number(item.qte ?? item.quantity ?? 1);
        const unitUsd = Number(item.priceUsd ?? item.price ?? 0);
        const unitCdf = Number(
          item.priceCdf ??
            (unitUsd > 0 ? unitUsd * exchangeRate : 0),
        );
        const subtotalUsd = Number(
          item.subTotalUsd ?? unitUsd * qty,
        );
        const subtotalCdf = Number(
          item.subTotalCdf ?? unitCdf * qty,
        );
        acc.totalUsd += subtotalUsd;
        acc.totalCdf += subtotalCdf;
        return acc;
      },
      { totalUsd: 0, totalCdf: 0 },
    );

    return {
      amountPaidUsd: Math.max(0, totals.totalUsd - (reductionUsd || 0)),
      amountPaidCdf: Math.max(0, totals.totalCdf - (reductionCdf || 0)),
    };
  };

  const proceedWithAddProduct = (product: any, quantity: number, targetInvoice: any) => {
    const updatedInvoices: Invoice[] = invoices.map((invoice: Invoice) => {
      if (invoice.id === targetInvoice.id) {
        const existingItem = invoice.items.find((item: any) => item.id === product.id);
        if (existingItem) {
          // Augmenter la quantité
          const updatedItems = invoice.items.map((item: any) =>
            item.id === product.id
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  qte: (item.qte ?? item.quantity ?? 0) + quantity,
                  total: (item.quantity + quantity) * item.price,
                  subTotalUsd: (item.subTotalUsd ?? item.price ?? 0) + (product.price * quantity),
                  subTotalCdf: (item.subTotalCdf ?? item.priceCdf ?? (item.price ?? 0) * exchangeRate) + ((item.priceCdf ?? product.price * exchangeRate) * quantity),
                }
              : item
          );
          const { amountPaidCdf, amountPaidUsd } = computePaidTotals(
            updatedItems,
            invoice.reductionCdf || 0,
            invoice.reductionUsd || 0,
          );
          return { ...invoice, items: updatedItems, total: amountPaidUsd, amountPaidCdf, amountPaidUsd };
        } else {
          // Ajouter nouveau produit
          const newItem = {
            id: product.id,
            name: product.name,
            quantity: quantity,
            qte: quantity,
            price: product.price,
            total: product.price * quantity,
            priceUsd: product.priceUsd ?? product.price ?? 0,
            priceCdf: product.priceCdf ?? (product.priceUsd ?? product.price ?? 0) * exchangeRate,
            subTotalUsd: (product.priceUsd ?? product.price ?? 0) * quantity,
            subTotalCdf: (product.priceCdf ?? (product.priceUsd ?? product.price ?? 0) * exchangeRate) * quantity,
          };
          const updatedItems = [...invoice.items, newItem];
          const { amountPaidCdf, amountPaidUsd } = computePaidTotals(
            updatedItems,
            invoice.reductionCdf || 0,
            invoice.reductionUsd || 0,
          );
          return { ...invoice, items: updatedItems, total: amountPaidUsd, amountPaidCdf, amountPaidUsd };
        }
      }
      return invoice;
    });

    setInvoices(updatedInvoices);
    const updatedInvoice = updatedInvoices.find((inv: Invoice) => inv.id === targetInvoice.id);
    if (updatedInvoice) {
      if (selectedInvoice) setSelectedInvoice(updatedInvoice);
      if (selectedInvoiceForDetails) setSelectedInvoiceForDetails(updatedInvoice);
    }
    
    // Reset selection after adding and switch to details tab
    setSelectedProduct(null);
    // Ne pas réinitialiser la quantité automatiquement pour permettre l'ajout répété
    // setProductQuantity(1);
    setActiveModalTab('details');
    setActiveDetailsTab('details');
  };

  const removeItemFromInvoice = (itemId: any) => {
    const targetInvoice = selectedInvoice || selectedInvoiceForDetails;
    if (!targetInvoice) return;

    const updatedInvoices: Invoice[] = invoices.map((invoice: Invoice) => {
      if (invoice.id === targetInvoice.id) {
        const itemToRemove = invoice.items.find((item: any) => item.id === itemId);
        if (!itemToRemove) return invoice;
        const updatedItems = invoice.items.filter((item: any) => item.id !== itemId);
        const { amountPaidCdf, amountPaidUsd } = computePaidTotals(
          updatedItems,
          invoice.reductionCdf || 0,
          invoice.reductionUsd || 0,
        );
        return { ...invoice, items: updatedItems, total: amountPaidUsd, amountPaidCdf, amountPaidUsd };
      }
      return invoice;
    });

    setInvoices(updatedInvoices);
    const updatedInvoice = updatedInvoices.find((inv: Invoice) => inv.id === targetInvoice.id);
    if (updatedInvoice) {
      if (selectedInvoice) setSelectedInvoice(updatedInvoice);
      if (selectedInvoiceForDetails) setSelectedInvoiceForDetails(updatedInvoice);
    }
  };

  const updateItemQuantity = (itemId: any, newQuantity: number) => {
    const targetInvoice = selectedInvoice || selectedInvoiceForDetails;
    if (!targetInvoice || newQuantity < 1) return;

    const updatedInvoices: Invoice[] = invoices.map((invoice: Invoice) => {
      if (invoice.id === targetInvoice.id) {
        const updatedItems = invoice.items.map((item: any) =>
          item.id === itemId
            ? {
                ...item,
                quantity: newQuantity,
                qte: newQuantity,
                total: newQuantity * item.price,
                subTotalUsd: (item.priceUsd ?? item.price ?? 0) * newQuantity,
                subTotalCdf: (item.priceCdf ?? (item.priceUsd ?? item.price ?? 0) * exchangeRate) * newQuantity,
              }
            : item
        );
        const { amountPaidCdf, amountPaidUsd } = computePaidTotals(
          updatedItems,
          invoice.reductionCdf || 0,
          invoice.reductionUsd || 0,
        );
        return { ...invoice, items: updatedItems, total: amountPaidUsd, amountPaidCdf, amountPaidUsd };
      }
      return invoice;
    });

    setInvoices(updatedInvoices);
    const updatedInvoice = updatedInvoices.find((inv: Invoice) => inv.id === targetInvoice.id);
    if (updatedInvoice) {
      if (selectedInvoice) setSelectedInvoice(updatedInvoice);
      if (selectedInvoiceForDetails) setSelectedInvoiceForDetails(updatedInvoice);
    }
  };

  // Composant de chargement pour la liste des factures
  const LoadingIndicator = () => (
    <View style={styles.loadingIndicator}>
      <Text style={styles.loadingText}>Chargement des factures...</Text>
    </View>
  );

  // Composant d'erreur pour la liste des factures
  const ErrorIndicator = () => (
    <View style={styles.errorIndicator}>
      <Text style={styles.errorText}>Erreur lors du chargement des factures</Text>
      <TouchableOpacity style={styles.retryButton} onPress={refetchInvoices}>
        <Text style={styles.retryButtonText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );

  // Fonction pour ajouter un produit à la facture en cours d'édition
  const addProductToEditingInvoice = (product: any, quantity: number = 1) => {
    if (!selectedInvoiceForDetails) return;

    const newItem = {
      id: `temp_${Date.now()}`, // ID temporaire
      productId: product.id,
      productName: product.name,
      qte: quantity,
      quantity: quantity,
      priceUsd: product.priceUsd || product.price,
      priceCdf: product.priceCdf || (product.price * exchangeRate),
      taux: exchangeRate,
      subTotalUsd: (product.priceUsd || product.price) * quantity,
      subTotalCdf: (product.priceCdf || (product.price * exchangeRate)) * quantity,
      name: product.name // Pour compatibilité
    };

    const updatedItems = [...selectedInvoiceForDetails.items, newItem];
    
    // Recalculer les totaux
    const newTotalUsd = updatedItems.reduce((sum: number, item: any) => sum + (item.subTotalUsd || 0), 0);
    const newTotalCdf = updatedItems.reduce((sum: number, item: any) => sum + (item.subTotalCdf || 0), 0);
    const amountPaidUsd = Math.max(0, newTotalUsd - (selectedInvoiceForDetails.reductionUsd || 0));
    const amountPaidCdf = Math.max(0, newTotalCdf - (selectedInvoiceForDetails.reductionCdf || 0));

    const updatedInvoice = {
      ...selectedInvoiceForDetails,
      items: updatedItems,
      totalUsd: newTotalUsd,
      totalCdf: newTotalCdf,
      amountPaidUsd,
      amountPaidCdf,
    };

    setSelectedInvoiceForDetails(updatedInvoice);
    
    // Reset selection
    setSelectedProduct(null);
    // Ne pas réinitialiser la quantité automatiquement pour permettre l'ajout répété
    // setProductQuantity(1);
  };

  // Fonction utilitaire pour créer l'objet de mise à jour selon la structure API requise
  const createUpdateData = () => {
    if (!selectedInvoiceForDetails) return null;

    // Pour mobile, utiliser editableItems si disponible, sinon utiliser les items originaux
    const itemsToUse = !isLargeScreen && editableItems.length > 0 ? editableItems : selectedInvoiceForDetails.items;


    return {
      id: selectedInvoiceForDetails.id,
      tableId: selectedInvoiceForDetails.tableId,
      userId: selectedInvoiceForDetails.userId,
      reductionCdf: Number(selectedInvoiceForDetails.reductionCdf || 0),
      reductionUsd: Number(selectedInvoiceForDetails.reductionUsd || 0),
      client: String(selectedInvoiceForDetails.customerName || ''),
      description: String(selectedInvoiceForDetails.description || ''),
      status: Number(selectedInvoiceForDetails.status),
      dette: selectedInvoiceForDetails.dette ?? false,
      typePaiement: selectedInvoiceForDetails.typePaiement || '',
      ventes: itemsToUse.map((item: any) => {
        // S'assurer que tous les champs requis sont présents
        const formattedItem = {
          id: item.id || item.productId, // Fallback si pas d'ID spécifique
          productId: item.productId || item.id, // ID du produit
          qte: Number(item.qte || item.quantity || 1),
          taux: Number(item.taux || exchangeRate),
          priceUsd: Number(item.priceUsd || 0),
          priceCdf: Number(item.priceCdf || 0)
        };

        return formattedItem;
      })
    };
  };

  // Fonction pour afficher l'alerte de confirmation avec les détails de la facture
  const showUpdateConfirmation = () => {
    if (!selectedInvoiceForDetails) return;

    // Préparer les données pour l'API selon la structure requise
    const updateData = createUpdateData();
    if (!updateData) return;

    // Afficher l'objet qui sera envoyé à l'API dans la console
     

    // Créer le message de confirmation avec les détails de la facture
    // Sur mobile, utiliser editableItems pour les calculs, sinon utiliser selectedInvoiceForDetails.items
    const itemsForCalculation = !isLargeScreen && editableItems.length > 0 ? editableItems : selectedInvoiceForDetails.items;
    const totalItems = itemsForCalculation.length;
    const totalCdf = itemsForCalculation.reduce((sum: number, item: any) => 
      sum + (item.subTotalCdf || item.priceCdf * (item.qte || item.quantity) || 0), 0
    );
    const totalUsd = totalCdf / exchangeRate;
    const totalAfterReductionCdf = totalCdf - (selectedInvoiceForDetails.reductionCdf || 0);
    const totalAfterReductionUsd = totalUsd - (selectedInvoiceForDetails.reductionUsd || 0);

    // Ajouter des informations sur les modifications si on est sur mobile
    const modificationInfo = !isLargeScreen && editableItems.length > 0 ? 
      `\n📱 MODIFICATIONS APPORTÉES :
🛒 Articles modifiés: ${editableItems.length} article(s)
💰 Nouveau total CDF: ${totalCdf.toFixed(0)} CDF
💰 Nouveau total USD: ${totalUsd.toFixed(2)} USD
✅ Nouveau total après réduction: ${totalAfterReductionCdf.toFixed(0)} CDF / ${totalAfterReductionUsd.toFixed(2)} USD` : '';

    const confirmationMessage = `Détails de la facture à modifier :

📋 ID: ${selectedInvoiceForDetails.id}
👤 Client: ${selectedInvoiceForDetails.customerName}
📝 Description: ${selectedInvoiceForDetails.description || 'Aucune'}
🏷️ Table: ${selectedInvoiceForDetails.tableNomination || 'N/A'}
📊 Statut: ${getStatusLabel(selectedInvoiceForDetails.status)}
🛒 Articles: ${totalItems} article(s)
💰 Total CDF: ${totalCdf.toFixed(0)} CDF
💰 Total USD: ${totalUsd.toFixed(2)} USD
🎯 Réduction CDF: ${selectedInvoiceForDetails.reductionCdf || 0} CDF
🎯 Réduction USD: ${selectedInvoiceForDetails.reductionUsd || 0} USD
✅ Total après réduction: ${totalAfterReductionCdf.toFixed(0)} CDF / ${totalAfterReductionUsd.toFixed(2)} USD${modificationInfo}

Voulez-vous confirmer la modification de cette facture ?`;

    // Utiliser window.confirm sur Web, Alert.alert sur mobile
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(confirmationMessage);
      if (confirmed) {
        handleUpdateInvoice(updateData);
      }
    } else {
      Alert.alert(
        'Confirmation de modification',
        confirmationMessage,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Confirmer',
            style: 'default',
            onPress: () => handleUpdateInvoice(updateData),
          },
        ]
      );
    }
  };

  // Fonction pour mettre à jour la facture
  const handleUpdateInvoice = async (updateData?: any) => {
    if (!selectedInvoiceForDetails) return;

    // Si updateData n'est pas fourni, le préparer selon la structure requise
    if (!updateData) {
      updateData = createUpdateData();
      if (!updateData) return;
    }

    setIsUpdatingInvoice(true);

    try {

      // Appeler l'API de mise à jour
      const response = await updateFacture(updateData);
      
      if (response.success) {
        // Mettre à jour la liste locale
        const updatedInvoices = invoices.map(invoice => 
          invoice.id === selectedInvoiceForDetails.id 
            ? selectedInvoiceForDetails 
            : invoice
        );
        setInvoices(updatedInvoices);

        // Afficher un message de succès
        Alert.alert('Succès', 'Facture mise à jour avec succès !');
        
        // Rafraîchir la liste depuis l'API
        refetchInvoices();
      } else {
        Alert.alert('Erreur', response.message || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', 'Erreur lors de la mise à jour de la facture');
    } finally {
      setIsUpdatingInvoice(false);
    }
  };

  // Fonction pour marquer une facture comme payée
  const handleMarkAsPayed = async (factureId: string) => {
    const confirmMessage = `Êtes-vous sûr de vouloir marquer la facture ${factureId} comme terminée ?`;
    
    // Utiliser window.confirm sur Web, Alert.alert sur mobile
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        await executeMarkAsPayed(factureId);
      }
    } else {
      Alert.alert(
        'Confirmation',
        confirmMessage,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Confirmer',
            style: 'default',
            onPress: () => executeMarkAsPayed(factureId),
          },
        ]
      );
    }
  };

  // Fonction pour marquer une facture comme annulée
  const handleMarkAsAborted = async (factureId: string) => {
    const currentStatus = selectedInvoiceForDetails?.status;
    const isCurrentlyPaused = currentStatus === 2;
    
    const actionText = isCurrentlyPaused ? 'annuler définitivement' : 'mettre en pause';
    const confirmMessage = `Êtes-vous sûr de vouloir ${actionText} la facture ${factureId} ?`;
    
    // Utiliser window.confirm sur Web, Alert.alert sur mobile
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        await executeMarkAsAborted(factureId);
      }
    } else {
      Alert.alert(
        'Confirmation',
        confirmMessage,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Confirmer',
            style: 'default',
            onPress: () => executeMarkAsAborted(factureId),
          },
        ]
      );
    }
  };

  // Fonction pour supprimer une facture
  const executeDeleteFacture = async (factureId: string) => {
    try {
      const response = await deleteFacture(factureId);
      
      // Check if the API response indicates success
      if (response && response.success === true) {
        // Supprimer la facture de la liste locale
        const updatedInvoices = invoices.filter(invoice => invoice.id !== factureId);
        setInvoices(updatedInvoices);
        
        // Fermer la modal de détails si c'est la facture sélectionnée
        if (selectedInvoiceForDetails && selectedInvoiceForDetails.id === factureId) {
          setSelectedInvoiceForDetails(null);
        }
        
        // Afficher un message de succès avec le message de l'API
        Alert.alert('Succès', response.message || 'Facture supprimée avec succès !');
        
        // Rafraîchir la liste depuis l'API
        refetchInvoices();
      } else {
        Alert.alert('Erreur', response?.message || 'Erreur lors de la suppression de la facture');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la facture:', error);
      Alert.alert('Erreur', `Erreur lors de la suppression de la facture`);
    }
  };

  // Fonction pour gérer la confirmation de suppression
  const handleDeleteFacture = (factureId: string) => {
    if (!factureId) {
      Alert.alert('Erreur', 'Identifiant de facture invalide.');
      return;
    }

    const confirmMessage = `Êtes-vous sûr de vouloir supprimer définitivement la facture ${factureId} ? Cette action est irréversible.`;

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        executeDeleteFacture(factureId);
      }
    } else {
      Alert.alert(
        'Confirmation',
        confirmMessage,
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: () => executeDeleteFacture(factureId),
          },
        ],
        { cancelable: true },
      );
    }
  };

  // Fonction pour exécuter le marquage comme payé
  const executeMarkAsPayed = async (factureId: string) => {
    try {
      // Marquer directement la facture comme payée (sans traitement du stock)
      const response = await markFactureAsPayed(factureId);
      
      if (response.success) {
        // Mettre à jour la facture locale
        const updatedInvoice = { ...selectedInvoiceForDetails, status: 1 };
        setSelectedInvoiceForDetails(updatedInvoice);
        
        // Mettre à jour la liste des factures
        const updatedInvoices = invoices.map(invoice => 
          invoice.id === factureId ? updatedInvoice : invoice
        );
        setInvoices(updatedInvoices);
        
        // Afficher un message de succès pour la facture
        Alert.alert('Succès', 'Facture marquée comme terminée avec succès !');
        
        // Rafraîchir la liste depuis l'API
        refetchInvoices();
      } else {
        Alert.alert('Erreur', response.message || 'Erreur lors du marquage de la facture');
      }
    } catch (error) {
      console.error('Erreur lors du marquage comme payé:', error);
      Alert.alert('Erreur', 'Erreur lors du marquage de la facture comme terminée');
    }
  };


  // Fonction pour exécuter le marquage comme annulé
  const executeMarkAsAborted = async (factureId: string) => {
    try {
      const response = await markFactureAsAborted(factureId);
      
      if (response.success) {
        // Mettre à jour la facture locale
        const updatedInvoice = { ...selectedInvoiceForDetails, status: 2 };
        setSelectedInvoiceForDetails(updatedInvoice);
        
        // Mettre à jour la liste des factures
        const updatedInvoices = invoices.map(invoice => 
          invoice.id === factureId ? updatedInvoice : invoice
        );
        setInvoices(updatedInvoices);
        
        // Afficher un message de succès
        const actionText = selectedInvoiceForDetails.status === 2 ? 'annulée' : 'mise en pause';
        Alert.alert('Succès', `Facture ${actionText} avec succès !`);
        
        // Rafraîchir la liste depuis l'API
        refetchInvoices();
      } else {
        Alert.alert('Erreur', response.message || 'Erreur lors du marquage de la facture');
      }
    } catch (error) {
      console.error('Erreur lors du marquage comme annulé:', error);
      Alert.alert('Erreur', 'Erreur lors du marquage de la facture');
    }
  };

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <View style={styles.containerWeb}>
        {/*<Text style={styles.titleWeb}>Gestion des Factures</Text>
        
         Header avec filtres 
        <View style={[styles.headerWeb,{visibility:'hidden'}]}>
          <View style={styles.headerLeft}>
            <Text style={styles.subtitleWeb}>Gérez les factures clients</Text>
          </View>
        </View>*/}

        {/* Contenu principal divisé en deux sections */}
        <View style={styles.mainContentWeb}>
          {/* Section gauche - Liste des factures */}
          <View style={styles.leftSectionWeb}>
            <ScrollView style={styles.leftScrollView}>
              {/* Filtres */}
        <View style={styles.filtersContainerWeb}>
          {/* Debug Info */}
          {/*<DebugInfo />*/}
          
          {/* Filtre par date */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Période:</Text>
            <View style={styles.dateFilterContainer}>
              <View style={styles.dateRangeDisplay}>
                <Text style={styles.dateRangeText}>
                  {formatDateForDisplay(startDate)} - {formatDateForDisplay(endDate)}
                </Text>
                <TouchableOpacity
                  style={styles.dateFilterButton}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      // Actualiser les factures sur web
                      refetchInvoices();
                    } else {
                      // Comportement mobile : ouvrir le date picker
                      setShowDatePicker(!showDatePicker);
                    }
                  }}
                >
                  <Ionicons 
                    name={Platform.OS === 'web' ? "refresh-outline" : "calendar-outline"} 
                    size={20} 
                    color="#6B7280" 
                  />
                  <Text style={styles.dateFilterButtonText}>
                    {Platform.OS === 'web' ? 'Actualiser' : 'Modifier'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Boutons de sélection de date pour web uniquement */}
              {Platform.OS === 'web' && (
                <View style={styles.webDateSelectionContainer}>
                  <TouchableOpacity
                    style={styles.webDateButton}
                    onPress={() => setShowStartDateModal(true)}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#007AFF" />
                    <Text style={styles.webDateButtonText}>Date de début</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.webDateButton}
                    onPress={() => setShowEndDateModal(true)}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#007AFF" />
                    <Text style={styles.webDateButtonText}>Date de fin</Text>
                  </TouchableOpacity>
                </View>
              )}

              
              {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Date de début:</Text>
                    <View style={styles.dateInputRow}>
                      <TextInput
                        style={[styles.dateInput, isEditingStartDate && styles.dateInputEditing]}
                        value={isEditingStartDate ? startDateText : formatDateForDisplay(startDate)}
                        placeholder="DD/MM/YYYY HH:MM"
                        onFocus={() => {
                          setIsEditingStartDate(true);
                          setStartDateText(formatDateForDisplay(startDate));
                        }}
                        onChangeText={handleStartDateTextChange}
                        onBlur={handleStartDateTextBlur}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => {
                          const newDate = new Date(startDate);
                          newDate.setDate(newDate.getDate() - 1);
                          setStartDate(newDate);
                          setStartDateText(formatDateForDisplay(newDate));
                        }}
                      >
                        <Ionicons name="chevron-back" size={16} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => {
                          const newDate = new Date(startDate);
                          newDate.setDate(newDate.getDate() + 1);
                          setStartDate(newDate);
                          setStartDateText(formatDateForDisplay(newDate));
                        }}
                      >
                        <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.dateInputHint}>Format: DD/MM/YYYY HH:MM (ex: 15/12/2024 14:30)</Text>
                  </View>
                  
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Date de fin:</Text>
                    <View style={styles.dateInputRow}>
                      <TextInput
                        style={[styles.dateInput, isEditingEndDate && styles.dateInputEditing]}
                        value={isEditingEndDate ? endDateText : formatDateForDisplay(endDate)}
                        placeholder="DD/MM/YYYY HH:MM"
                        onFocus={() => {
                          setIsEditingEndDate(true);
                          setEndDateText(formatDateForDisplay(endDate));
                        }}
                        onChangeText={handleEndDateTextChange}
                        onBlur={handleEndDateTextBlur}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => {
                          const newDate = new Date(endDate);
                          newDate.setDate(newDate.getDate() - 1);
                          setEndDate(newDate);
                          setEndDateText(formatDateForDisplay(newDate));
                        }}
                      >
                        <Ionicons name="chevron-back" size={16} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => {
                          const newDate = new Date(endDate);
                          newDate.setDate(newDate.getDate() + 1);
                          setEndDate(newDate);
                          setEndDateText(formatDateForDisplay(newDate));
                        }}
                      >
                        <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.dateInputHint}>Format: DD/MM/YYYY HH:MM (ex: 16/12/2024 18:00)</Text>
                  </View>
                  
                  <View style={styles.datePickerActions}>
                    <TouchableOpacity
                      style={styles.resetDateButton}
                      onPress={resetToDefaultDateRange}
                    >
                      <Text style={styles.resetDateButtonText}>Par défaut</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.applyDateButton}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.applyDateButtonText}>Appliquer</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Filtre par statut */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Statut:</Text>
            <View style={styles.filterButtons}>
              {['Toutes', 'Payées', 'Non payées'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterButton,
                    selectedStatus === status && styles.filterButtonActive
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    selectedStatus === status && styles.filterButtonTextActive
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Filtre par table */}
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Table:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterButtons}>
                <TouchableOpacity
                  key="Toutes"
                  style={[
                    styles.filterButton,
                    selectedTable === 'Toutes' && styles.filterButtonActive
                  ]}
                  onPress={() => setSelectedTable('Toutes')}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedTable === 'Toutes' && styles.filterButtonTextActive
                    ]}
                  >
                    Toutes
                  </Text>
                </TouchableOpacity>
                {tablesLoading && (
                  <View style={styles.filterButton}>
                    <Text style={styles.filterButtonText}>Chargement...</Text>
                  </View>
                )}
                {!tablesLoading && tables.length === 0 && !tablesError && (
                  <View style={styles.filterButton}>
                    <Text style={styles.filterButtonText}>Aucune table</Text>
                  </View>
                )}
                {!tablesLoading && tablesError && (
                  <View style={styles.filterButton}>
                    <Text style={styles.filterButtonText}>Erreur</Text>
                  </View>
                )}
                {!tablesLoading && tables.map((table: any) => (
                  <TouchableOpacity
                    key={table.value}
                    style={[
                      styles.filterButton,
                      selectedTable === table.value && styles.filterButtonActive
                    ]}
                    onPress={() => setSelectedTable(table.value)}
                  >
                    <Text
                      style={[
                        styles.filterButtonText,
                        selectedTable === table.value && styles.filterButtonTextActive
                      ]}
                    >
                      {table.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Recherche */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par nom client ou numéro..."
              placeholderTextColor="#9CA3AF"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>
          <View style={styles.reportActionsWeb}>
            <TouchableOpacity
              style={styles.reportButtonWeb}
              onPress={() => handleOpenInvoiceReport()}
            >
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
              <Text style={styles.reportButtonTextWeb}>Rapport factures</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.reportButtonWeb, styles.reportButtonSecondaryWeb]}
                onPress={() => handleOpenInvoiceReport({ autoPrint: true })}
              >
                <Ionicons name="print" size={18} color="#FFFFFF" />
                <Text style={styles.reportButtonTextWeb}>Imprimer PDF</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* Statistiques */}
        <View style={styles.statsContainerWeb}>
          <View style={styles.statCardWeb}>
            <Text style={styles.statValueWeb}>{filteredInvoices.length}</Text>
            <Text style={styles.statLabelWeb}>Total factures</Text>
          </View>
          <View style={styles.statCardWeb}>
            <Text style={styles.statValueWeb}>{filteredInvoices.filter((inv: Invoice) => inv.status === 0).length}</Text>
            <Text style={styles.statLabelWeb}>En cours</Text>
          </View>
          <View style={styles.statCardWeb}>
            <Text style={styles.statValueWeb}>{filteredInvoices.filter((inv: Invoice) => inv.status === 1).length}</Text>
            <Text style={styles.statLabelWeb}>Terminées</Text>
          </View>
          <View style={styles.statCardWeb}>
            <Text style={styles.statValueWeb}>{filteredInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.amountPaidCdf || 0), 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</Text>
            <Text style={styles.statLabelWeb}>Total CDF</Text>
          </View>
        </View>

        {/* Grille des cartes de factures */}
        <View style={styles.invoicesGridWeb}>
          {invoicesLoading ? (
            <LoadingIndicator />
          ) : invoicesError ? (
            <ErrorIndicator />
          ) : filteredInvoices.length === 0 ? (
            <View style={styles.emptyStateWeb}>
              <Ionicons name="document-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyStateTitleWeb}>Aucune facture trouvée</Text>
              <Text style={styles.emptyStateTextWeb}>Aucune facture ne correspond aux critères de recherche</Text>
            </View>
          ) : (
            filteredInvoices.map((invoice: Invoice) => (
              <TouchableOpacity
                key={invoice.id}
                style={[
                  styles.invoiceCardWeb,
                  selectedInvoiceForDetails?.id === invoice.id && styles.invoiceCardSelectedWeb
                ]}
                onPress={() => selectInvoiceForDetails(invoice)}
              >
                {/* Header de la carte */}
                <View style={styles.invoiceCardHeaderWeb}>
                  <View style={styles.invoiceCardHeaderLeftWeb}>
                    <Text style={styles.invoiceCardIdWeb}>{invoice.tableNomination || 'Table'}</Text>
                    <Text style={styles.invoiceCardDateHeaderWeb}>{invoice.date}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(invoice.status)}</Text>
                  </View>
                </View>

                {/* Informations client */}
                <View style={styles.invoiceCardClientWeb}>
                  <Text style={styles.invoiceCardCustomerNameWeb}>{invoice.customerName}</Text>
                  <Text style={styles.invoiceCardCustomerEmailWeb}>{invoice.description}</Text>
                  <View style={styles.invoicePaymentRowWeb}>
                    <View style={styles.invoiceBadgeRowWeb}>
                      <View
                        style={[
                          styles.invoiceDebtBadgeWeb,
                          invoice.dette
                            ? styles.invoiceDebtBadgeDebtWeb
                            : styles.invoiceDebtBadgePaidWeb,
                        ]}
                      >
                        <Text
                          style={[
                            styles.invoiceDebtBadgeTextWeb,
                            invoice.dette
                              ? styles.invoiceDebtBadgeTextDebtWeb
                              : styles.invoiceDebtBadgeTextPaidWeb,
                          ]}
                        >
                          {invoice.dette ? 'DETTE' : 'PAYÉ'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.invoicePaymentTypeContainerWeb}>
                      <Ionicons name="card-outline" size={14} color="#6B7280" />
                      <Text style={styles.invoicePaymentTypeTextWeb}>
                        {invoice.typePaiement || 'Type inconnu'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Informations facture */}
                <View style={styles.invoiceCardInfoWeb}>
                  <View style={styles.invoiceCardInfoRowWeb}>
                    <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                    <Text style={styles.invoiceCardDateWeb}>{invoice.date}</Text>
                  </View>
                  <View style={styles.invoiceCardInfoRowWeb}>
                    <Ionicons name="receipt-outline" size={16} color="#6B7280" />
                    <Text style={styles.invoiceCardItemsWeb}>{invoice.items.length} article(s)</Text>
                  </View>
                  {invoice.userName && (
                    <View style={styles.invoiceCardInfoRowWeb}>
                      <Ionicons name="person-outline" size={16} color="#6B7280" />
                      <Text style={styles.invoiceCardItemsWeb}>{invoice.userName}</Text>
                    </View>
                  )}
                </View>

                {/* Footer avec total */}
                <View style={styles.invoiceCardFooterWeb}>
                  <View style={styles.invoiceCardTotalsWeb}>
                    <Text style={styles.invoiceCardTotalWeb}>{(invoice.amountPaidCdf || 0).toFixed(0)} CDF</Text>
                    <Text style={[styles.invoiceCardTotalUsdWeb, { fontSize: 18, marginRight: 40 }]}>${(invoice.amountPaidUsd || 0).toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.invoiceCardActionWeb}
                    onPress={() => selectInvoiceForDetails(invoice)}
                  >
                    <Ionicons name="eye" size={18} color="#7C3AED" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
        </ScrollView>
          </View>

          {/* Section droite - Mode édition de la facture */}
          <View style={styles.rightSectionWeb}>
            {selectedInvoiceForDetails ? (
              <View style={styles.editContainerWeb}>
                {/* Header de la section droite */}
                <View style={styles.editHeaderWeb}>
                  <View style={styles.editTitleRowWeb}>
                    <Text style={styles.editTitleWeb}>Modifier la facture</Text>
                    <Text style={styles.editRateWeb}>Taux: {exchangeRate} CDF/USD</Text>
                  </View>
                  <Text style={styles.editSubtitleWeb}>{selectedInvoiceForDetails.tableNomination || 'Table'}</Text>
                </View>

                {/* Onglets */}
                <View style={styles.editTabsWeb}>
                  <TouchableOpacity
                    style={[styles.editTabWeb, activeDetailsTab === 'edit' && styles.editTabActiveWeb]}
                    onPress={() => setActiveDetailsTab('edit')}
                  >
                    <Text style={[styles.editTabTextWeb, activeDetailsTab === 'edit' && styles.editTabTextActiveWeb]}>
                      Édition
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editTabWeb, activeDetailsTab === 'products' && styles.editTabActiveWeb, {visibility: 'hidden'}]}
                    onPress={() => setActiveDetailsTab('products')}
                  >
                    <Text style={[styles.editTabTextWeb, activeDetailsTab === 'products' && styles.editTabTextActiveWeb]}>
                      Produits
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Contenu des onglets */}
                <ScrollView style={styles.editContentWeb}>
                  {activeDetailsTab === 'edit' ? (
                    <View>

                      {/* Informations client */}
                <View style={styles.editSectionWeb}>
                  <Text style={styles.editSectionTitleWeb}>Informations Client</Text>
                  <TextInput
                    style={styles.editInputWeb}
                    value={selectedInvoiceForDetails.customerName}
                    onChangeText={(text) => {
                      const updatedInvoice = { ...selectedInvoiceForDetails, customerName: text };
                      setSelectedInvoiceForDetails(updatedInvoice);
                    }}
                    placeholder="Nom du client"
                  />
                  <TextInput
                    style={styles.editInputWeb}
                    value={selectedInvoiceForDetails.description}
                    onChangeText={(text) => {
                      const updatedInvoice = { ...selectedInvoiceForDetails, description: text };
                      setSelectedInvoiceForDetails(updatedInvoice);
                    }}
                    placeholder="Description"
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.editPaymentContainerWeb}>
                    <Text style={styles.editSectionSubtitleWeb}>Mode de paiement</Text>
                    <View style={styles.paymentMethodChipsWeb}>
                      {paymentMethodOptions.map((method) => {
                        const isSelected = (selectedInvoiceForDetails.typePaiement || '').toLowerCase() === method.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={method}
                            style={[
                              styles.paymentMethodChipWeb,
                              isSelected && styles.paymentMethodChipActiveWeb,
                            ]}
                            onPress={() => {
                              const updatedInvoice = { ...selectedInvoiceForDetails, typePaiement: method };
                              setSelectedInvoiceForDetails(updatedInvoice);
                            }}
                          >
                            <Text
                              style={[
                                styles.paymentMethodChipTextWeb,
                                isSelected && styles.paymentMethodChipTextActiveWeb,
                              ]}
                            >
                              {method}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.debtToggleContainerWeb}>
                    <Text style={styles.editSectionSubtitleWeb}>Dette</Text>
                    <View style={styles.debtToggleOptionsWeb}>
                      {[{ label: 'OUI', value: true }, { label: 'NON', value: false }].map((option) => {
                        const isSelected = (selectedInvoiceForDetails.dette ?? false) === option.value;
                        return (
                          <TouchableOpacity
                            key={option.label}
                            style={[
                              styles.debtToggleButtonWeb,
                              isSelected && styles.debtToggleButtonActiveWeb,
                            ]}
                            onPress={() => {
                              const updatedInvoice = { ...selectedInvoiceForDetails, dette: option.value };
                              setSelectedInvoiceForDetails(updatedInvoice);
                            }}
                          >
                            <Text
                              style={[
                                styles.debtToggleButtonTextWeb,
                                isSelected && styles.debtToggleButtonTextActiveWeb,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                      </View>

                      {/* Articles de la facture */}
                <View style={styles.editSectionWeb}>
                  <Text style={styles.editSectionTitleWeb}>Articles</Text>
                  {selectedInvoiceForDetails.items.map((item: any, index: number) => {
                    const handleDecrease = () => {
                      const newItems = [...selectedInvoiceForDetails.items];
                      if (newItems[index].qte > 1) {
                        newItems[index].qte -= 1;
                        newItems[index].subTotalUsd = newItems[index].qte * newItems[index].priceUsd;
                        newItems[index].subTotalCdf = newItems[index].qte * newItems[index].priceCdf;
                        setSelectedInvoiceForDetails({ ...selectedInvoiceForDetails, items: newItems });
                      }
                    };

                    const handleIncrease = () => {
                      const newItems = [...selectedInvoiceForDetails.items];
                      newItems[index].qte += 1;
                      newItems[index].subTotalUsd = newItems[index].qte * newItems[index].priceUsd;
                      newItems[index].subTotalCdf = newItems[index].qte * newItems[index].priceCdf;
                      setSelectedInvoiceForDetails({ ...selectedInvoiceForDetails, items: newItems });
                    };

                    const handleRemove = () => {
                      const newItems = selectedInvoiceForDetails.items.filter((_: any, i: number) => i !== index);
                      setSelectedInvoiceForDetails({ ...selectedInvoiceForDetails, items: newItems });
                    };

                    return (
                      <View key={index} style={styles.editItemRowWeb}>
                        <View style={styles.editItemInfoWeb}>
                          <Text style={styles.editItemNameWeb}>{item.productName || item.name}</Text>
                          <Text style={styles.editItemPriceWeb}>
                            ${item.priceUsd?.toFixed(2) || '0.00'} / {item.priceCdf?.toFixed(0) || '0'} CDF
                          </Text>
                        </View>

                        <View style={styles.editItemActionsWeb}>
                          <TouchableOpacity onPress={handleDecrease} style={styles.editQuantityButtonWeb}>
                            <Ionicons name="remove" size={16} color="#6B7280" />
                          </TouchableOpacity>

                          <Text style={styles.editQuantityTextWeb}>{item.qte || item.quantity}</Text>

                          <TouchableOpacity onPress={handleIncrease} style={styles.editQuantityButtonWeb}>
                            <Ionicons name="add" size={16} color="#6B7280" />
                          </TouchableOpacity>

                          <TouchableOpacity onPress={handleRemove} style={styles.editRemoveButtonWeb}>
                            <Ionicons name="trash" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>


                <View style={styles.editSectionWeb}>
                  <Text style={styles.editSectionTitleWeb}>Total panier</Text>
                  <View style={styles.editTotalRowWeb}>
                    <Text style={styles.editTotalLabelWeb}>Total CDF:</Text>
                    <Text style={styles.editTotalValueWeb}>
                      {invoiceTotals.basketTotalCdf.toFixed(0)} CDF
                    </Text>
                  </View>
                  <View style={styles.editTotalRowWeb}>
                    <Text style={styles.editTotalLabelWeb}>Total USD:</Text>
                    <Text style={styles.editTotalValueWeb}>
                      {invoiceTotals.basketTotalUsd.toFixed(2)} USD
                    </Text>
                  </View>
                </View>

                {/* Totaux de la facture */}
                <View style={styles.editSectionWeb}>
                  
                  <Text style={styles.editSectionTitleWeb}>Total payé</Text>
                  <View style={styles.editTotalRowWeb}>
                    <Text style={styles.editTotalLabelWeb}>Total CDF:</Text>
                    <Text style={styles.editTotalValueWeb}>
                    {invoiceTotals.paidCdf.toFixed(0)} CDF
                    </Text>
                  </View>
                  <View style={styles.editTotalRowWeb}>
                    <Text style={styles.editTotalLabelWeb}>Total USD:</Text>
                    <Text style={styles.editTotalValueWeb}>
                      {invoiceTotals.paidUsd.toFixed(2)} USD
                    </Text>
                  </View>
                  <View style={styles.editTotalAfterReductionRowWeb}>
                    <Text style={styles.editTotalAfterReductionLabelWeb}>Montant payé:</Text>
                    <View style={styles.editTotalAfterReductionValueContainerWeb}>
                      <>
                        <Text style={styles.editTotalAfterReductionValueWeb}>
                          {invoiceTotals.paidCdf.toFixed(0)} CDF
                        </Text>
                        <Text style={styles.editReductionDetailWeb}>
                          MONTANT PAYÉ USD: {invoiceTotals.paidUsd.toFixed(2)}
                        </Text>
                        <Text style={styles.editReductionDetailWeb}>
                          REDUCTION CDF: {invoiceTotals.reductionCdf.toFixed(0)},  REDUCTION USD: {invoiceTotals.reductionUsd.toFixed(2)}
                        </Text>
                      </>
                    </View>
                  </View>
                </View>

                <View style={styles.editSectionWeb}>
                  <Text style={styles.editSectionTitleWeb}>Reste</Text>
                  <View style={styles.editTotalRowWeb}>
                    <Text style={styles.editTotalLabelWeb}>Reste CDF:</Text>
                    <Text style={styles.editTotalValueWeb}>
                      {invoiceTotals.remainingCdf.toFixed(0)} CDF
                    </Text>
                  </View>
                  <View style={styles.editTotalRowWeb}>
                    <Text style={styles.editTotalLabelWeb}>Reste USD:</Text>
                    <Text style={styles.editTotalValueWeb}>
                      {invoiceTotals.remainingUsd.toFixed(2)} USD
                    </Text>
                  </View>
                </View>

                <View style={[styles.editSectionWeb, styles.paymentSectionWeb]}>
                  <Text style={styles.editSectionTitleWeb}>Faire un paiement</Text>
                  <Text style={styles.paymentInfoTextWeb}>
                    Taux: {exchangeRate} • Reste CDF: {invoiceTotals.remainingCdf.toFixed(0)} • Reste USD: {invoiceTotals.remainingUsd.toFixed(2)}
                  </Text>
                  <View style={styles.paymentAmountRowWeb}>
                    <Text style={styles.paymentLabelWeb}>Montant</Text>
                    <TextInput
                      style={styles.editInputWeb}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType={paymentDevise === 1 ? 'decimal-pad' : 'numeric'}
                      value={paymentAmount}
                      onChangeText={handlePaymentAmountChange}
                    />
                  </View>
                  <View style={styles.paymentDeviseGroupWeb}>
                    {paymentDeviseOptions.map(option => {
                      const isSelected = paymentDevise === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.paymentDeviseButtonWeb,
                            isSelected && styles.paymentDeviseButtonActiveWeb,
                          ]}
                          onPress={() => handlePaymentDeviseChange(option.value)}
                        >
                          <Text
                            style={[
                              styles.paymentDeviseButtonTextWeb,
                              isSelected && styles.paymentDeviseButtonTextActiveWeb,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TextInput
                    style={[styles.editInputWeb, styles.paymentObservationInputWeb]}
                    placeholder="Observation (optionnelle)"
                    placeholderTextColor="#9CA3AF"
                    value={paymentObservation}
                    onChangeText={setPaymentObservation}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    style={[
                      styles.paymentSubmitButtonWeb,
                      (isSubmittingPayment || !isPaymentAmountPositive || paymentLimit <= 0) && styles.paymentSubmitButtonDisabledWeb,
                    ]}
                    onPress={handleAddPayment}
                    disabled={isSubmittingPayment || !isPaymentAmountPositive || paymentLimit <= 0}
                  >
                    {isSubmittingPayment ? (
                      <>
                        <Ionicons name="hourglass" size={18} color="#FFFFFF" />
                        <Text style={styles.paymentSubmitButtonTextWeb}>Enregistrement...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.paymentSubmitButtonTextWeb}>Enregistrer le paiement</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.paymentHistoryButtonWeb}
                    onPress={handleOpenPaymentsModal}
                  >
                    <Ionicons name="time-outline" size={18} color="#1F2937" />
                    <Text style={styles.paymentHistoryButtonTextWeb}>Historique des paiements</Text>
                  </TouchableOpacity>
                </View>
                      
                
                      
                {/* Boutons d'action */}
                <View style={[styles.editButtonContainerWeb, { marginBottom: -10 }]}>
                  <TouchableOpacity
                    style={styles.printButtonWeb}
                    onPress={() => setShowPrintModal(true)}
                  >
                    <Ionicons name="print" size={20} color="#FFFFFF" />
                    <Text style={styles.printButtonTextWeb}>Imprimer facture</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.editButtonWeb, { backgroundColor: '#EF4444',marginTop: -2 }]}
                    onPress={() => {
                      if (selectedInvoiceForDetails?.id) {
                        handleDeleteFacture(selectedInvoiceForDetails.id);
                      } else {
                        console.error('❌ No facture selected for deletion');
                        Alert.alert('Erreur', 'Aucune facture sélectionnée pour la suppression');
                      }
                    }}
                  >
                    <Ionicons name="trash" size={20} color="#FFFFFF" />
                    <Text style={styles.editButtonTextWeb}>Supprimer facture</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.editButtonWeb,
                      isUpdatingInvoice && styles.editButtonDisabledWeb
                    ]}
                    onPress={showUpdateConfirmation}
                    disabled={isUpdatingInvoice}
                  >
                    {isUpdatingInvoice ? (
                      <>
                        <Ionicons name="hourglass" size={20} color="#FFFFFF" />
                        <Text style={styles.editButtonTextWeb}>Modification en cours...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="save" size={20} color="#FFFFFF" />
                        <Text style={styles.editButtonTextWeb}>Modifier la facture</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                    </View>
                  ) : (
                    <View>
                      {/* Indicateurs de chargement */}
                      {(categoriesLoading || productsLoading) && (
                        <View style={styles.loadingContainerWeb}>
                          <Text style={styles.loadingTextWeb}>Chargement des produits...</Text>
                        </View>
                      )}
                      
                      {/* Erreurs */}
                      {(categoriesError || productsError) && (
                        <View style={styles.errorContainerWeb}>
                          <Text style={styles.errorTextWeb}>Erreur lors du chargement des produits</Text>
                        </View>
                      )}
                      
                      {/* Contenu principal */}
                      {!categoriesLoading && !productsLoading && !categoriesError && !productsError && (
                        <>
                      {/* En-tête avec quantité et bouton */}
                      <View style={styles.productHeaderWeb}>
                        <View style={styles.quantityInputContainerWeb}>
                          <Text style={styles.quantityLabelWeb}>Quantité:</Text>
                          <TextInput
                            style={styles.quantityInputWeb}
                            value={productQuantity.toString()}
                            onChangeText={(text) => {
                              const value = parseInt(text);
                              setProductQuantity(isNaN(value) ? 0 : value);
                            }}
                            keyboardType="numeric"
                            placeholder="1"
                          />
                          <TouchableOpacity
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              backgroundColor: '#F3F4F6',
                              borderWidth: 1,
                              borderColor: '#D1D5DB',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                            onPress={() => setProductQuantity(1)}
                          >
                            <Ionicons name="refresh" size={16} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.addToInvoiceButtonWeb,
                            (!selectedProduct || productQuantity <= 0) && styles.addToInvoiceButtonDisabledWeb
                          ]}
                              onPress={() => selectedProduct && productQuantity > 0 && addProductToEditingInvoice(selectedProduct, productQuantity)}
                          disabled={!selectedProduct || productQuantity <= 0}
                        >
                          <Ionicons name="add" size={20} color="white" />
                          <Text style={styles.addToInvoiceButtonTextWeb}>
                            Ajouter à la facture
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      {/* Sélecteur de catégories */}
                      <View style={styles.categorySelectorWeb}>
                        <Text style={styles.categoryLabelWeb}>Catégorie:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.categoryButtonsWeb}>
                            {productCategories.map((category) => (
                              <TouchableOpacity
                                key={category}
                                style={[
                                  styles.categoryButtonWeb,
                                  selectedProductCategory === category && styles.categoryButtonActiveWeb
                                ]}
                                onPress={() => setSelectedProductCategory(category)}
                              >
                                <Text style={[
                                  styles.categoryButtonTextWeb,
                                  selectedProductCategory === category && styles.categoryButtonTextActiveWeb
                                ]}>
                                  {category}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                      
                      {/* Grille de produits */}
                      <View style={styles.productsGridWeb}>
                        {filteredProducts.length > 0 ? (
                          filteredProducts.map((product: any) => (
                            <TouchableOpacity
                              key={product.id}
                              style={[
                                styles.productCardWeb,
                                selectedProduct?.id === product.id && styles.productCardSelectedWeb,
                                (product.stock === 0 || product.stock < 1) && styles.productCardOutOfStockWeb,
                              ]}
                              onPress={() => setSelectedProduct(product)}
                            >
                              {selectedProduct?.id === product.id && (
                                <View style={styles.checkIconContainerWeb}>
                                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                </View>
                              )}

                              <View style={styles.productCardContentWeb}>
                                <Text numberOfLines={2} style={styles.productNameWeb}>
                                  {product.name}
                                </Text>
                                <Text style={styles.productCategoryWeb}>{product.category}</Text>

                                <View style={styles.productPriceContainerWeb}>
                                  <Text style={styles.productPriceWeb}>${(product.price || 0).toFixed(2)}</Text>
                                  <Text style={styles.productPriceCdfWeb}>
                                    {(product.priceCdf || 0).toFixed(0)} CDF
                                  </Text>
                                </View>

                                <Text
                                  style={[
                                    styles.productStockWeb,
                                    (product.stock === 0 || product.stock < 1) &&
                                      styles.productStockOutOfStockWeb,
                                  ]}
                                >
                                  Stock: {product.stock || 0}
                                  {(product.stock === 0 || product.stock < 1) && ' (Rupture)'}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.emptyProductsWeb}>
                            <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyProductsTextWeb}>Aucun produit trouvé</Text>
                            <Text style={styles.emptyProductsSubtextWeb}>
                              {selectedProductCategory === 'Toutes'
                                ? 'Aucun produit disponible'
                                : `Aucun produit dans la catégorie "${selectedProductCategory}"`}
                            </Text>
                          </View>
                        )}
                      </View>
                        </>
                      )}
                    </View>
                  )}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.emptyStateWeb}>
                <Ionicons name="document-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyStateTitleWeb}>Sélectionnez une facture</Text>
                <Text style={styles.emptyStateTextWeb}>Cliquez sur une facture dans la liste pour la modifier</Text>
              </View>
            )}
          </View>
        </View>

        {renderInvoiceReportModal()}

        {/* Modal d'impression */}
        {showPrintModal && selectedInvoiceForDetails && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1} 
              onPress={() => setShowPrintModal(false)}
            />
            <View style={styles.printModalContainer}>
              <View style={styles.printModalHeader}>
                <Text style={styles.printModalTitle}>Détail facture</Text>
                <TouchableOpacity onPress={() => setShowPrintModal(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.printModalContent}>
                {/* Informations de la facture */}
                <View style={styles.printSection}>
                  <Text style={styles.printSectionTitle}>Informations générales</Text>
                  <View style={styles.printInfoRow}>
                    <Text style={styles.printInfoLabel}>Client:</Text>
                    <Text style={styles.printInfoValue}>{selectedInvoiceForDetails.customerName}</Text>
                  </View>
                  <View style={styles.printInfoRow}>
                    <Text style={styles.printInfoLabel}>Table:</Text>
                    <Text style={styles.printInfoValue}>{selectedInvoiceForDetails.tableNomination || 'N/A'}</Text>
                  </View>
                  <View style={styles.printInfoRow}>
                    <Text style={styles.printInfoLabel}>Date:</Text>
                    <Text style={styles.printInfoValue}>{selectedInvoiceForDetails.date}</Text>
                  </View>
                  <View style={styles.printInfoRow}>
                    <Text style={styles.printInfoLabel}>Créé le:</Text>
                    <Text style={styles.printInfoValue}>
                      {selectedInvoiceForDetails.createdAt 
                        ? new Date(selectedInvoiceForDetails.createdAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : new Date().toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                      }
                    </Text>
                  </View>
                  <View style={styles.printInfoRow}>
                    <Text style={styles.printInfoLabel}>Statut:</Text>
                    <Text style={styles.printInfoValue}>{getStatusLabel(selectedInvoiceForDetails.status)}</Text>
                  </View>
                  {selectedInvoiceForDetails.description && (
                    <View style={styles.printInfoRow}>
                      <Text style={styles.printInfoLabel}>Description:</Text>
                      <Text style={styles.printInfoValue}>{selectedInvoiceForDetails.description}</Text>
                    </View>
                  )}
                </View>

                {/* Articles */}
                <View style={styles.printSection}>
                  <Text style={styles.printSectionTitle}>Articles</Text>
                  {selectedInvoiceForDetails.items.map((item: any, index: number) => (
                    <View key={index} style={styles.printItemRow}>
                      <View style={styles.printItemInfo}>
                        <Text style={styles.printItemName}>{item.productName || item.name}</Text>
                        <Text style={styles.printItemDetails}>
                          {item.qte || item.quantity} x ${item.priceUsd?.toFixed(2) || '0.00'} USD
                        </Text>
                        <Text style={styles.printItemDetails}>
                          {item.qte || item.quantity} x {item.priceCdf?.toFixed(0) || '0'} CDF
                        </Text>
                      </View>
                      <Text style={styles.printItemTotal}>
                        ${(item.subTotalUsd || 0).toFixed(2)} USD
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Totaux */}
                <View style={styles.printSection}>
                  <Text style={styles.printSectionTitle}>Totaux</Text>
                  <View style={styles.printTotalRow}>
                    <Text style={styles.printTotalLabel}>Total CDF:</Text>
                    <Text style={styles.printTotalValue}>
                      {(selectedInvoiceForDetails.items?.reduce((sum: number, item: any) => 
                        sum + (item.subTotalCdf || item.priceCdf * (item.qte || item.quantity) || 0), 0
                      ) || 0).toFixed(0)} CDF
                    </Text>
                  </View>
                  <View style={styles.printTotalRow}>
                    <Text style={styles.printTotalLabel}>Total USD:</Text>
                    <Text style={styles.printTotalValue}>
                      ${((selectedInvoiceForDetails.items?.reduce((sum: number, item: any) => 
                        sum + (item.subTotalCdf || item.priceCdf * (item.qte || item.quantity) || 0), 0
                      ) || 0) / exchangeRate).toFixed(2)} USD
                    </Text>
                  </View>
                  {(selectedInvoiceForDetails.reductionCdf > 0 || selectedInvoiceForDetails.reductionUsd > 0) && (
                    <>
                      <View style={styles.printTotalRow}>
                        <Text style={styles.printTotalLabel}>Réduction CDF:</Text>
                        <Text style={styles.printTotalValue}>-{selectedInvoiceForDetails.reductionCdf || 0} CDF</Text>
                      </View>
                      <View style={styles.printTotalRow}>
                        <Text style={styles.printTotalLabel}>Réduction USD:</Text>
                        <Text style={styles.printTotalValue}>-${selectedInvoiceForDetails.reductionUsd || 0} USD</Text>
                      </View>
                    </>
                  )}
                  <View style={styles.printTotalAfterReductionRow}>
                    <Text style={styles.printTotalAfterReductionLabel}>Montant payé:</Text>
                    <View style={styles.printTotalAfterReductionValueContainer}>
                      {(() => {
                        const fallbackCdf = (selectedInvoiceForDetails.items?.reduce((sum: number, item: any) =>
                          sum + (item.subTotalCdf || item.priceCdf * (item.qte || item.quantity) || 0), 0
                        ) || 0) - (selectedInvoiceForDetails.reductionCdf || 0);
                        const paidCdf = Number(selectedInvoiceForDetails.amountPaidCdf ?? fallbackCdf);
                        const fallbackUsd = (selectedInvoiceForDetails.items?.reduce((sum: number, item: any) =>
                          sum + (item.subTotalUsd || item.priceUsd * (item.qte || item.quantity) || 0), 0
                        ) || 0) - (selectedInvoiceForDetails.reductionUsd || 0);
                        const paidUsd = Number(selectedInvoiceForDetails.amountPaidUsd ?? fallbackUsd);
                        return (
                          <>
                            <Text style={styles.printTotalAfterReductionValue}>
                              {paidCdf.toFixed(0)} CDF
                            </Text>
                            <Text style={styles.printReductionDetail}>
                              MONTANT PAYÉ USD: {paidUsd.toFixed(2)}
                            </Text>
                            <Text style={styles.printReductionDetail}>
                              REDUCTION CDF: {(Number(selectedInvoiceForDetails.reductionCdf) || 0).toFixed(0)}, REDUCTION USD: {(Number(selectedInvoiceForDetails.reductionUsd) || 0).toFixed(2)}
                            </Text>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Boutons de la modal */}
              <View style={styles.printModalButtons}>
                <TouchableOpacity
                  style={styles.printModalCancelButton}
                  onPress={() => setShowPrintModal(false)}
                >
                  <Text style={styles.printModalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.printModalPrintButton, isPrinting && styles.printModalPrintButtonDisabled]}
                  onPress={handlePrintFacture}
                  disabled={isPrinting}
                >
                  <Ionicons name="print" size={20} color="#FFFFFF" />
                  <Text style={styles.printModalPrintButtonText}>
                    {isPrinting ? 'Impression...' : 'Imprimer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        
        {showPaymentsModal && (
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={handleClosePaymentsModal}
            />
            <View style={styles.paymentsModalContainer}>
              <View style={styles.paymentsModalHeader}>
                <Text style={styles.paymentsModalTitle}>Historique des paiements</Text>
                <TouchableOpacity onPress={handleClosePaymentsModal} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.paymentsModalContent}>
                {paymentsLoading ? (
                  <View style={styles.paymentsModalLoading}>
                    <ActivityIndicator size="large" color="#7C3AED" />
                    <Text style={styles.paymentsModalLoadingText}>Chargement des paiements...</Text>
                  </View>
                ) : paymentsError ? (
                  <Text style={styles.paymentsModalError}>{paymentsError}</Text>
                ) : payments.length === 0 ? (
                  <View style={styles.paymentsModalEmpty}>
                    <Ionicons name="card-outline" size={24} color="#9CA3AF" />
                    <Text style={styles.paymentsModalEmptyText}>
                      Aucun paiement enregistré pour cette facture.
                    </Text>
                  </View>
                ) : (
                  payments.map((payment: any) => {
                    const amountCdf = Number(payment.amountCdf) || 0;
                    const amountUsd = Number(payment.amountUsd) || 0;
                    const taux = Number(payment.taux) || exchangeRate;
                    return (
                      <View key={payment.id} style={styles.paymentHistoryCard}>
                        <View style={styles.paymentHistoryRow}>
                          <Text style={styles.paymentHistoryLabel}>Montant CDF</Text>
                          <Text style={styles.paymentHistoryValue}>{amountCdf.toFixed(0)} CDF</Text>
                        </View>
                        <View style={styles.paymentHistoryRow}>
                          <Text style={styles.paymentHistoryLabel}>Montant USD</Text>
                          <Text style={styles.paymentHistoryValue}>{amountUsd.toFixed(2)} USD</Text>
                        </View>
                        <View style={styles.paymentHistoryRow}>
                          <Text style={styles.paymentHistoryLabel}>Taux</Text>
                          <Text style={styles.paymentHistoryValue}>{taux}</Text>
                        </View>
                        <Text style={styles.paymentHistoryObservation}>
                          {payment.observation ? `Observation: ${payment.observation}` : 'Pas de note'}
                        </Text>
                        <Text style={styles.paymentHistoryDate}>
                          Créé le {formatPaymentDate(payment.created)}
                        </Text>
                        <View style={styles.paymentHistoryActions}>
                          <TouchableOpacity
                            style={[
                              styles.deletePaymentButton,
                              deletingPaymentId === payment.id && styles.deletePaymentButtonDisabled,
                            ]}
                            onPress={() => handleDeletePayment(payment.id)}
                            disabled={deletingPaymentId === payment.id}
                          >
                            {deletingPaymentId === payment.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Ionicons name="trash" size={16} color="#FFFFFF" />
                                <Text style={styles.deletePaymentButtonText}>Supprimer</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Modals de calendrier pour web uniquement */}
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
      </View>
    );
  }

  // Version Mobile
  return (
    <>
    <ScrollView style={styles.containerMobile}>
      <Text style={styles.titleMobile}>Gestion des Factures</Text>
      
      {/* Filtres */}
      <View style={styles.filtersContainerMobile}>
        {/* Filtre par date */}
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Période:</Text>
          <View style={styles.dateFilterContainer}>
            <View style={styles.dateRangeDisplay}>
              <Text style={styles.dateRangeText}>
                {formatDateForDisplay(startDate)} - {formatDateForDisplay(endDate)}
              </Text>
              <TouchableOpacity
                style={styles.dateFilterButton}
                onPress={() => setShowDatePicker(!showDatePicker)}
              >
                <Ionicons name="calendar-outline" size={20} color="#6B7280" />
                <Text style={styles.dateFilterButtonText}>Modifier</Text>
              </TouchableOpacity>
            </View>
            
            {/* Boutons de sélection de date pour mobile */}
            <View style={styles.mobileDateSelectionContainer}>
              <TouchableOpacity
                style={[styles.mobileDateButton, { backgroundColor: '#E3F2FD' }]}
                onPress={() => {
                  setShowMobileStartDateModal(true);
                }}
              >
                <Ionicons name="calendar-outline" size={16} color="#007AFF" />
                <Text style={styles.mobileDateButtonText}>Date de début</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mobileDateButton, { backgroundColor: '#E3F2FD' }]}
                onPress={() => {
                  setShowMobileEndDateModal(true);
                }}
              >
                <Ionicons name="calendar-outline" size={16} color="#007AFF" />
                <Text style={styles.mobileDateButtonText}>Date de fin</Text>
              </TouchableOpacity>
            </View>
            
            {showDatePicker && (
                <View style={styles.datePickerContainer}>
                  <View style={styles.dateInputGroup}>
                    <Text style={styles.dateInputLabel}>Date de début:</Text>
                    <View style={styles.dateInputRow}>
                      <TextInput
                        style={[styles.dateInput, isEditingStartDate && styles.dateInputEditing]}
                        value={isEditingStartDate ? startDateText : formatDateForDisplay(startDate)}
                        placeholder="DD/MM/YYYY HH:MM"
                        onFocus={() => {
                          setIsEditingStartDate(true);
                          setStartDateText(formatDateForDisplay(startDate));
                        }}
                        onChangeText={handleStartDateTextChange}
                        onBlur={handleStartDateTextBlur}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => {
                          const newDate = new Date(startDate);
                          newDate.setDate(newDate.getDate() - 1);
                          setStartDate(newDate);
                          setStartDateText(formatDateForDisplay(newDate));
                        }}
                      >
                        <Ionicons name="chevron-back" size={16} color="#6B7280" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => {
                          const newDate = new Date(startDate);
                          newDate.setDate(newDate.getDate() + 1);
                          setStartDate(newDate);
                          setStartDateText(formatDateForDisplay(newDate));
                        }}
                      >
                        <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.dateInputHint}>Format: DD/MM/YYYY HH:MM</Text>
                  </View>
                
                <View style={styles.dateInputGroup}>
                  <Text style={styles.dateInputLabel}>Date de fin:</Text>
                  <View style={styles.dateInputRow}>
                    <TextInput
                      style={[styles.dateInput, isEditingEndDate && styles.dateInputEditing]}
                      value={isEditingEndDate ? endDateText : formatDateForDisplay(endDate)}
                      placeholder="DD/MM/YYYY HH:MM"
                      onFocus={() => {
                        setIsEditingEndDate(true);
                        setEndDateText(formatDateForDisplay(endDate));
                      }}
                      onChangeText={handleEndDateTextChange}
                      onBlur={handleEndDateTextBlur}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => {
                        const newDate = new Date(endDate);
                        newDate.setDate(newDate.getDate() - 1);
                        setEndDate(newDate);
                        setEndDateText(formatDateForDisplay(newDate));
                      }}
                    >
                      <Ionicons name="chevron-back" size={16} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => {
                        const newDate = new Date(endDate);
                        newDate.setDate(newDate.getDate() + 1);
                        setEndDate(newDate);
                        setEndDateText(formatDateForDisplay(newDate));
                      }}
                    >
                      <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.dateInputHint}>Format: DD/MM/YYYY HH:MM</Text>
                </View>
                
                <View style={styles.datePickerActions}>
                  <TouchableOpacity
                    style={styles.resetDateButton}
                    onPress={resetToDefaultDateRange}
                  >
                    <Text style={styles.resetDateButtonText}>Par défaut</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.applyDateButton}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Text style={styles.applyDateButtonText}>Appliquer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Statut:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              {['Toutes', 'Payées', 'Non payées'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterButton,
                    selectedStatus === status && styles.filterButtonActive
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text style={[
                    styles.filterButtonText,
                    selectedStatus === status && styles.filterButtonTextActive
                  ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Table:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterButtons}>
              <TouchableOpacity
                key="Toutes-mobile"
                style={[
                  styles.filterButton,
                  selectedTable === 'Toutes' && styles.filterButtonActive
                ]}
                onPress={() => setSelectedTable('Toutes')}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    selectedTable === 'Toutes' && styles.filterButtonTextActive
                  ]}
                >
                  Toutes
                </Text>
              </TouchableOpacity>
              {tablesLoading && (
                <View style={styles.filterButton}>
                  <Text style={styles.filterButtonText}>Chargement...</Text>
                </View>
              )}
              {!tablesLoading && tables.length === 0 && !tablesError && (
                <View style={styles.filterButton}>
                  <Text style={styles.filterButtonText}>Aucune table</Text>
                </View>
              )}
              {!tablesLoading && tablesError && (
                <View style={styles.filterButton}>
                  <Text style={styles.filterButtonText}>Erreur</Text>
                </View>
              )}
              {!tablesLoading && tables.map((table: any) => (
                <TouchableOpacity
                  key={`${table.value}-mobile`}
                  style={[
                    styles.filterButton,
                    selectedTable === table.value && styles.filterButtonActive
                  ]}
                  onPress={() => setSelectedTable(table.value)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedTable === table.value && styles.filterButtonTextActive
                    ]}
                  >
                    {table.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor="#9CA3AF"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      <View style={styles.reportActionsMobile}>
        <TouchableOpacity
          style={styles.reportButtonMobile}
          onPress={() => handleOpenInvoiceReport()}
        >
          <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
          <Text style={styles.reportButtonMobileText}>Rapport factures</Text>
        </TouchableOpacity>
        {Platform.OS === 'web' && (
          <TouchableOpacity
            style={[styles.reportButtonMobile, styles.reportButtonMobileSecondary]}
            onPress={() => handleOpenInvoiceReport({ autoPrint: true })}
          >
            <Ionicons name="print" size={16} color="#FFFFFF" />
            <Text style={styles.reportButtonMobileText}>Imprimer PDF</Text>
          </TouchableOpacity>
        )}
      </View>
      </View>

      {/* Statistiques */}
      <View style={styles.statsContainerMobile}>
        <View style={styles.statCardMobile}>
          <Text style={styles.statValueMobile}>{filteredInvoices.length}</Text>
          <Text style={styles.statLabelMobile}>Total</Text>
        </View>
        <View style={styles.statCardMobile}>
          <Text style={styles.statValueMobile}>{filteredInvoices.filter((inv: Invoice) => inv.status === 0).length}</Text>
          <Text style={styles.statLabelMobile}>En cours</Text>
        </View>
        <View style={styles.statCardMobile}>
          <Text style={styles.statValueMobile}>{filteredInvoices.reduce((sum: number, inv: Invoice) => sum + (inv.amountPaidCdf || 0), 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</Text>
          <Text style={styles.statLabelMobile}>Total CDF</Text>
        </View>
      </View>

      {/* Liste des factures ou Détails */}
      {!selectedInvoice ? (
        <View style={styles.invoicesListMobile}>
          {invoicesLoading ? (
            <LoadingIndicator />
          ) : invoicesError ? (
            <ErrorIndicator />
          ) : filteredInvoices.length === 0 ? (
            <View style={styles.emptyStateMobile}>
              <Ionicons name="document-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitleMobile}>Aucune facture trouvée</Text>
              <Text style={styles.emptyStateTextMobile}>Aucune facture ne correspond aux critères de recherche</Text>
            </View>
          ) : (
            filteredInvoices.map((invoice: Invoice) => (
            <TouchableOpacity
              key={invoice.id}
              style={styles.invoiceCardMobile}
              onPress={() => openInvoiceModal(invoice)}
            >
              {/* Header */}
              <View style={styles.invoiceHeaderMobile}>
                <View style={styles.invoiceHeaderLeftMobile}>
                  <Text style={styles.invoiceIdMobile}>{invoice.tableNomination || 'Table'}</Text>
                  <Text style={styles.invoiceDateHeaderMobile}>{invoice.date}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) }]}>
                  <Text style={styles.statusText}>{getStatusLabel(invoice.status)}</Text>
                </View>
              </View>
              
              {/* Informations client */}
              <View style={styles.clientSectionMobile}>
                <Text style={styles.customerNameMobile}>{invoice.customerName}</Text>
                <Text style={styles.customerEmailMobile}>{invoice.description}</Text>
              </View>

              {/* Informations supplémentaires */}
              <View style={styles.invoiceInfosMobile}>
                <View style={styles.infoItemMobile}>
                  <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoTextMobile}>{invoice.date}</Text>
                </View>
                <View style={styles.infoItemMobile}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoTextMobile}>
                    Créé le {invoice.createdAt 
                      ? new Date(invoice.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : new Date().toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                    }
                  </Text>
                </View>
                <View style={styles.infoItemMobile}>
                  <Ionicons name="receipt-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoTextMobile}>{invoice.items.length} article(s)</Text>
                </View>
                {invoice.userName && (
                  <View style={styles.infoItemMobile}>
                    <Ionicons name="person-outline" size={14} color="#6B7280" />
                    <Text style={styles.infoTextMobile}>{invoice.userName}</Text>
                  </View>
                )}
                <View style={styles.infoItemMobile}>
                  <Ionicons name="card-outline" size={14} color="#6B7280" />
                  <Text style={styles.infoTextMobile}>
                    {invoice.typePaiement || 'Type inconnu'}
                  </Text>
                </View>
                <View style={styles.infoItemMobile}>
                  <View
                    style={[
                      styles.invoiceDebtBadgeMobile,
                      invoice.dette
                        ? styles.invoiceDebtBadgeDebtMobile
                        : styles.invoiceDebtBadgePaidMobile,
                    ]}
                  >
                    <Text
                      style={[
                        styles.invoiceDebtBadgeTextMobile,
                        invoice.dette
                          ? styles.invoiceDebtBadgeTextDebtMobile
                          : styles.invoiceDebtBadgeTextPaidMobile,
                      ]}
                    >
                      {invoice.dette ? 'DETTE' : 'PAYÉ'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Footer avec total */}
              <View style={styles.invoiceFooterMobile}>
                <Text style={styles.totalLabelMobile}>Total:</Text>
                <View style={styles.totalContainerMobile}>
                  <Text style={styles.invoiceTotalMobile}>
                    {(invoice.amountPaidCdf || 0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF
                  </Text>
                  <Text style={styles.invoiceTotalUsdMobile}>
                    ${(invoice.amountPaidUsd || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            ))
          )}
        </View>
      ) : (
        /* Détails de la facture sur mobile */
        <View style={styles.invoiceDetailsMobile}>
          <View style={styles.detailsHeaderMobile}>
            <Text style={styles.detailsTitleMobile}>Détail facture</Text>
          </View>

          {/* Onglets pour mobile */}
          <View style={styles.mobileTabContainer}>
            <TouchableOpacity
              style={[
                styles.mobileTab,
                activeMobileTab === 'details' && styles.mobileTabActive
              ]}
              onPress={() => setActiveMobileTab('details')}
            >
              <Ionicons 
                name="information-circle-outline" 
                size={20} 
                color={activeMobileTab === 'details' ? '#7C3AED' : '#6B7280'} 
              />
              <Text style={[
                styles.mobileTabText,
                activeMobileTab === 'details' && styles.mobileTabTextActive
              ]}>
                Détails
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.mobileTab,
                activeMobileTab === 'products' && styles.mobileTabActive
              ]}
              onPress={() => setActiveMobileTab('products')}
            >
              <Ionicons 
                name="grid-outline" 
                size={20} 
                color={activeMobileTab === 'products' ? '#7C3AED' : '#6B7280'} 
              />
              <Text style={[
                styles.mobileTabText,
                activeMobileTab === 'products' && styles.mobileTabTextActive
              ]}>
                Produits
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contenu conditionnel selon l'onglet */}
          {activeMobileTab === 'details' ? (
            <>
              {/* Informations générales */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Informations générales</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Table:</Text>
                  <Text style={styles.infoValue}>{selectedInvoice?.tableNomination || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date:</Text>
                  <Text style={styles.infoValue}>{selectedInvoice?.date}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Créé le:</Text>
                  <Text style={styles.infoValue}>
                    {selectedInvoice?.createdAt 
                      ? new Date(selectedInvoice.createdAt).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : new Date().toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                    }
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Statut:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedInvoice?.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(selectedInvoice?.status)}</Text>
                  </View>
                </View>
              </View>

              {/* Client */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Client</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nom:</Text>
                  <Text style={styles.infoValue}>{selectedInvoice?.customerName || 'N/A'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Description:</Text>
                  <Text style={styles.infoValue}>{selectedInvoice?.description || 'N/A'}</Text>
                </View>
              </View>

              {/* Paiement */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Paiement</Text>
                <Text style={styles.mobileSectionLabel}>Mode de paiement</Text>
                <View style={styles.mobilePaymentChips}>
                  {paymentMethodOptions.map((method) => {
                    const isSelected = (selectedInvoice?.typePaiement || '').toLowerCase() === method.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.mobilePaymentChip,
                          isSelected && styles.mobilePaymentChipActive
                        ]}
                        onPress={() => handleMobilePaymentMethodChange(method)}
                      >
                        <Text
                          style={[
                            styles.mobilePaymentChipText,
                            isSelected && styles.mobilePaymentChipTextActive
                          ]}
                        >
                          {method}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.mobileSectionLabel, { marginTop: 16 }]}>Dette</Text>
                <View style={styles.mobileDebtToggleRow}>
                  {[{ label: 'OUI', value: true }, { label: 'NON', value: false }].map((option) => {
                    const isSelected = (selectedInvoice?.dette ?? false) === option.value;
                    return (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.mobileDebtButton,
                          option.value ? styles.mobileDebtButtonDebt : styles.mobileDebtButtonPaid,
                          isSelected && (option.value ? styles.mobileDebtButtonActiveDebt : styles.mobileDebtButtonActivePaid),
                          option.label === 'OUI' ? styles.mobileDebtButtonSpacing : null
                        ]}
                        onPress={() => handleMobileDebtToggle(option.value)}
                      >
                        <Text
                          style={[
                            styles.mobileDebtButtonText,
                            isSelected && (option.value ? styles.mobileDebtButtonTextActiveDebt : styles.mobileDebtButtonTextActivePaid)
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Articles modifiables */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Articles ({editableItems.length})</Text>
                {editableItems.length > 0 ? (
                  editableItems.map((item: any, index: number) => (
                    <View key={item.id || index} style={styles.mobileEditableItemRow}>
                      <View style={styles.mobileEditableItemInfo}>
                        <Text style={styles.mobileEditableItemName}>{item.productName || item.name || 'Produit'}</Text>
                        <Text style={styles.mobileEditableItemPrice}>
                          ${item.priceUsd?.toFixed(2) || '0.00'} / {item.priceCdf?.toFixed(0) || '0'} CDF
                        </Text>
                      </View>
                      <View style={styles.mobileEditableItemActions}>
                        <TouchableOpacity
                          style={styles.mobileQuantityButton}
                          onPress={() => {
                            const newItems = [...editableItems];
                            if (newItems[index].qte > 1) {
                              newItems[index].qte -= 1;
                              newItems[index].subTotalUsd = newItems[index].qte * (newItems[index].priceUsd || 0);
                              newItems[index].subTotalCdf = newItems[index].qte * (newItems[index].priceCdf || 0);
                              setEditableItems(newItems);
                            }
                          }}
                        >
                          <Ionicons name="remove" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <Text style={styles.mobileQuantityText}>{item.qte || 1}</Text>
                        <TouchableOpacity
                          style={styles.mobileQuantityButton}
                          onPress={() => {
                            const newItems = [...editableItems];
                            newItems[index].qte += 1;
                            newItems[index].subTotalUsd = newItems[index].qte * (newItems[index].priceUsd || 0);
                            newItems[index].subTotalCdf = newItems[index].qte * (newItems[index].priceCdf || 0);
                            setEditableItems(newItems);
                          }}
                        >
                          <Ionicons name="add" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.mobileDeleteItemButton}
                          onPress={() => {
                            const newItems = editableItems.filter((_: any, i: number) => i !== index);
                            setEditableItems(newItems);
                          }}
                        >
                          <Ionicons name="trash" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.infoValue}>Aucun article</Text>
                )}
              </View>

              {/* Totaux dynamiques */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Totaux</Text>
                {(() => {
                  const totalCdf = editableItems.reduce((sum: number, item: any) => 
                    sum + (item.subTotalCdf || item.priceCdf * (item.qte || item.quantity) || 0), 0);
                  const totalUsd = editableItems.reduce((sum: number, item: any) => 
                    sum + (item.subTotalUsd || item.priceUsd * (item.qte || item.quantity) || 0), 0);
                  const reductionCdf = selectedInvoice?.reductionCdf || 0;
                  const reductionUsd = selectedInvoice?.reductionUsd || 0;
                  const totalAfterReductionCdf = totalCdf - reductionCdf;
                  const totalAfterReductionUsd = totalUsd - reductionUsd;
                  const amountPaidCdf = Number(selectedInvoice?.amountPaidCdf ?? totalAfterReductionCdf);
                  const amountPaidUsd = Number(selectedInvoice?.amountPaidUsd ?? totalAfterReductionUsd);
                  
                  return (
                    <>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total CDF:</Text>
                        <Text style={styles.totalValue}>{totalCdf.toFixed(0)} CDF</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total USD:</Text>
                        <Text style={styles.totalValue}>${totalUsd.toFixed(2)}</Text>
                      </View>
                      {(reductionCdf > 0 || reductionUsd > 0) && (
                        <>
                          <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Réduction CDF:</Text>
                            <Text style={[styles.totalValue, { color: '#EF4444' }]}>
                              -{reductionCdf.toFixed(0)} CDF
                            </Text>
                          </View>
                          <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Réduction USD:</Text>
                            <Text style={[styles.totalValue, { color: '#EF4444' }]}>
                              -${reductionUsd.toFixed(2)}
                            </Text>
                          </View>
                        </>
                      )}
                      <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 8, marginTop: 8 }]}>
                        <Text style={[styles.totalLabel, { fontWeight: 'bold', fontSize: 16 }]}>Total à payer:</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.totalValue, { fontWeight: 'bold', fontSize: 18, color: '#7C3AED' }]}>
                            {amountPaidCdf.toFixed(0)} CDF
                          </Text>
                          <Text style={[styles.totalValue, { fontSize: 14, color: '#6B7280' }]}>
                            ${amountPaidUsd.toFixed(2)}
                          </Text>
                          <Text style={{ marginTop: 4, fontSize: 12, color: '#DC2626', fontWeight: '700', textAlign: 'right' }}>
                            REDUCTION CDF: {(Number(selectedInvoice?.reductionCdf) || 0).toFixed(0)}, REDUCTION USD: {(Number(selectedInvoice?.reductionUsd) || 0).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Faire un paiement</Text>
                <Text style={styles.paymentInfoTextMobile}>
                  Taux: {exchangeRate}{'\n'}
                  Reste CDF: {invoiceTotals.remainingCdf.toFixed(0)} • Reste USD: {invoiceTotals.remainingUsd.toFixed(2)}
                </Text>
                <Text style={styles.paymentLabelMobile}>Montant</Text>
                <TextInput
                  style={styles.paymentInputMobile}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType={paymentDevise === 1 ? 'decimal-pad' : 'numeric'}
                  value={paymentAmount}
                  onChangeText={handlePaymentAmountChange}
                />
                <View style={styles.paymentDeviseRowMobile}>
                  {paymentDeviseOptions.map(option => {
                    const isSelected = paymentDevise === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.paymentDeviseButtonMobile,
                          isSelected && styles.paymentDeviseButtonActiveMobile,
                        ]}
                        onPress={() => handlePaymentDeviseChange(option.value)}
                      >
                        <Text
                          style={[
                            styles.paymentDeviseButtonTextMobile,
                            isSelected && styles.paymentDeviseButtonTextActiveMobile,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.paymentObservationInputMobile}
                  placeholder="Observation (optionnelle)"
                  placeholderTextColor="#9CA3AF"
                  value={paymentObservation}
                  onChangeText={setPaymentObservation}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={[
                    styles.paymentSubmitButtonMobile,
                    (isSubmittingPayment || !isPaymentAmountPositive || paymentLimit <= 0) && styles.paymentSubmitButtonDisabledMobile,
                  ]}
                  onPress={handleAddPayment}
                  disabled={isSubmittingPayment || !isPaymentAmountPositive || paymentLimit <= 0}
                >
                  {isSubmittingPayment ? (
                    <>
                      <Ionicons name="hourglass" size={18} color="#FFFFFF" />
                      <Text style={styles.paymentSubmitButtonTextMobile}>Enregistrement...</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.paymentSubmitButtonTextMobile}>Enregistrer le paiement</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.paymentHistoryButtonMobile}
                  onPress={handleOpenPaymentsModal}
                >
                  <Ionicons name="time-outline" size={16} color="#1F2937" />
                  <Text style={styles.paymentHistoryButtonTextMobile}>Historique des paiements</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* Onglet Produits */
            <ScrollView style={styles.productsScrollView}>
              {/* Filtre par catégorie */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Filtrer par catégorie</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilterContainer}>
                  {['Toutes', ...categories.map((cat: any) => cat.name)].map((categoryName) => (
                    <TouchableOpacity
                      key={categoryName}
                      style={[
                        styles.categoryFilterButton,
                        selectedProductCategory === categoryName && styles.categoryFilterButtonActive
                      ]}
                      onPress={() => setSelectedProductCategory(categoryName)}
                    >
                      <Text style={[
                        styles.categoryFilterText,
                        selectedProductCategory === categoryName && styles.categoryFilterTextActive
                      ]}>
                        {categoryName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Champ de sélection du produit */}
              {selectedProductForAddition && (
                <View style={styles.section}>
                  <View style={styles.productSelectionContainer}>
                    <Text style={styles.productSelectionTitle}>
                      Produit sélectionné: {selectedProductForAddition.name}
                    </Text>
                    <View style={styles.quantityInputContainer}>
                      <Text style={styles.quantityLabel}>Quantité:</Text>
                      <TextInput
                        style={[styles.quantityInput, { textAlign: 'center' }]}
                        value={quantityForAddition}
                        onChangeText={(text) => {
                          // Validation: seulement les nombres positifs
                          const numericValue = text.replace(/[^0-9]/g, '');
                          if (numericValue === '' || parseInt(numericValue) >= 1) {
                            setQuantityForAddition(numericValue || '1');
                          }
                        }}
                        placeholder="1"
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.addToInvoiceButton}
                        onPress={() => {
                          const quantity = parseInt(quantityForAddition) || 1;
                          
                          // Vérifier si le produit existe déjà dans la facture
                          const existingItemIndex = editableItems.findIndex(
                            item => item.productId === selectedProductForAddition.id
                          );
                          
                          if (existingItemIndex >= 0) {
                            // Produit existe déjà : augmenter la quantité
                            const newItems = [...editableItems];
                            newItems[existingItemIndex].qte += quantity;
                            newItems[existingItemIndex].subTotalUsd = newItems[existingItemIndex].qte * (newItems[existingItemIndex].priceUsd || 0);
                            newItems[existingItemIndex].subTotalCdf = newItems[existingItemIndex].qte * (newItems[existingItemIndex].priceCdf || 0);
                            setEditableItems(newItems);
                          } else {
                            // Nouveau produit : l'ajouter à la liste
                            const newItem = {
                              id: selectedProductForAddition.id, // Utiliser l'ID du produit
                              productId: selectedProductForAddition.id, // ID du produit
                              productName: selectedProductForAddition.name,
                              name: selectedProductForAddition.name,
                              priceUsd: selectedProductForAddition.priceUsd || 0,
                              priceCdf: selectedProductForAddition.priceCdf || 0,
                              qte: quantity,
                              quantity: quantity,
                              subTotalUsd: (selectedProductForAddition.priceUsd || 0) * quantity,
                              subTotalCdf: (selectedProductForAddition.priceCdf || 0) * quantity,
                              taux: exchangeRate
                            };
                            
                            setEditableItems([...editableItems, newItem]);
                          }
                          
                          // Réinitialiser la sélection
                          setSelectedProductForAddition(null);
                          setQuantityForAddition('1');
                          
                          // Basculer vers l'onglet Détails
                          setActiveMobileTab('details');
                        }}
                        disabled={!quantityForAddition || parseInt(quantityForAddition) < 1}
                      >
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                        <Text style={styles.addToInvoiceButtonText}>Ajouter</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.cancelSelectionButton}
                      onPress={() => {
                        setSelectedProductForAddition(null);
                        setQuantityForAddition('1');
                      }}
                    >
                      <Ionicons name="close" size={16} color="#6B7280" />
                      <Text style={styles.cancelSelectionText}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Liste des produits */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Produits disponibles ({filteredProducts.length})</Text>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product: any) => (
                    <View key={product.id} style={styles.mobileProductCard}>
                      <View style={styles.mobileProductInfo}>
                        <Text style={styles.mobileProductName}>{product.name}</Text>
                        <Text style={styles.mobileProductPrice}>
                          ${product.priceUsd?.toFixed(2) || '0.00'} / {product.priceCdf?.toFixed(0) || '0'} CDF
                        </Text>
                        {product.categoryName && (
                          <Text style={styles.mobileProductCategory}>
                            Catégorie: {product.categoryName}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.mobileAddProductButton}
                        onPress={() => {
                          setSelectedProductForAddition(product);
                          setQuantityForAddition('1');
                        }}
                      >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                        <Text style={styles.mobileAddProductButtonText}>Ajouter</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.infoValue}>Aucun produit disponible</Text>
                )}
              </View>
            </ScrollView>
          )}

          {/* Actions de la facture */}
          <View style={styles.mobileInvoiceActions}>
            <TouchableOpacity 
              style={styles.mobileActionButton}
              onPress={() => {
                
                // Appeler la fonction de confirmation comme sur web
                showMobilePrintConfirmation();
              }}
            >
              <Ionicons name="print" size={20} color="#FFFFFF" />
              <Text style={styles.mobileActionButtonText}>Imprimer facture</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.mobileActionButton, styles.mobileActionButtonDanger]}
              onPress={() => {
                handleDeleteFacture(selectedInvoiceForDetails?.id);
              }}
            >
              <Ionicons name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.mobileActionButtonText}>Supprimer facture</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.mobileActionButton, styles.mobileActionButtonPrimary]}
              onPress={() => {
                
                // Appeler la fonction de confirmation comme sur web
                showUpdateConfirmation();
              }}
              disabled={isUpdatingInvoice}
            >
              <Ionicons name="save" size={20} color="#FFFFFF" />
              <Text style={styles.mobileActionButtonText}>
                {isUpdatingInvoice ? 'Modification...' : 'Modifier'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bouton Fermer */}
          <TouchableOpacity
            style={styles.closeDetailsMobile}
            onPress={closeInvoiceModal}
          >
            <Ionicons name="close-circle" size={24} color="#FFFFFF" />
            <Text style={styles.closeDetailsTextMobile}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}


      {renderInvoiceReportModal()}

      {/* Modals de calendrier pour mobile (bottom sheet) */}
      <BottomSheetCalendarModal
        visible={showMobileStartDateModal}
        onClose={() => {
          setShowMobileStartDateModal(false);
        }}
        selectedDate={startDate}
        onDateSelect={handleMobileStartDateSelect}
        title="Sélectionner la date de début"
      />
      <BottomSheetCalendarModal
        visible={showMobileEndDateModal}
        onClose={() => {
          setShowMobileEndDateModal(false);
        }}
        selectedDate={endDate}
        onDateSelect={handleMobileEndDateSelect}
        title="Sélectionner la date de fin"
      />

    </ScrollView>
    {showPaymentsModal && (
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={handleClosePaymentsModal}
        />
        <View style={styles.paymentsModalContainer}>
          <View style={styles.paymentsModalHeader}>
            <Text style={styles.paymentsModalTitle}>Historique des paiements</Text>
            <TouchableOpacity onPress={handleClosePaymentsModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.paymentsModalContent}>
            {paymentsLoading ? (
              <View style={styles.paymentsModalLoading}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.paymentsModalLoadingText}>Chargement des paiements...</Text>
              </View>
            ) : paymentsError ? (
              <Text style={styles.paymentsModalError}>{paymentsError}</Text>
            ) : payments.length === 0 ? (
              <View style={styles.paymentsModalEmpty}>
                <Ionicons name="card-outline" size={24} color="#9CA3AF" />
                <Text style={styles.paymentsModalEmptyText}>
                  Aucun paiement enregistré pour cette facture.
                </Text>
              </View>
            ) : (
              payments.map((payment: any) => {
                const amountCdf = Number(payment.amountCdf) || 0;
                const amountUsd = Number(payment.amountUsd) || 0;
                const taux = Number(payment.taux) || exchangeRate;
                return (
                  <View key={payment.id} style={styles.paymentHistoryCard}>
                    <View style={styles.paymentHistoryRow}>
                      <Text style={styles.paymentHistoryLabel}>Montant CDF</Text>
                      <Text style={styles.paymentHistoryValue}>{amountCdf.toFixed(0)} CDF</Text>
                    </View>
                    <View style={styles.paymentHistoryRow}>
                      <Text style={styles.paymentHistoryLabel}>Montant USD</Text>
                      <Text style={styles.paymentHistoryValue}>{amountUsd.toFixed(2)} USD</Text>
                    </View>
                    <View style={styles.paymentHistoryRow}>
                      <Text style={styles.paymentHistoryLabel}>Taux</Text>
                      <Text style={styles.paymentHistoryValue}>{taux}</Text>
                    </View>
                    <Text style={styles.paymentHistoryObservation}>
                      {payment.observation ? `Observation: ${payment.observation}` : 'Pas de note'}
                    </Text>
                    <Text style={styles.paymentHistoryDate}>
                      Créé le {formatPaymentDate(payment.created)}
                    </Text>
                    <View style={styles.paymentHistoryActions}>
                      <TouchableOpacity
                        style={[
                          styles.deletePaymentButton,
                          deletingPaymentId === payment.id && styles.deletePaymentButtonDisabled,
                        ]}
                        onPress={() => handleDeletePayment(payment.id)}
                        disabled={deletingPaymentId === payment.id}
                      >
                        {deletingPaymentId === payment.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="trash" size={16} color="#FFFFFF" />
                            <Text style={styles.deletePaymentButtonText}>Supprimer</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    )}
    </>
  );
};

const styles = StyleSheet.create({
  // Container Web
  containerWeb: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  mainContentWeb: {
    flex: 1,
    flexDirection: 'row',
    gap: 24,
  },
  leftSectionWeb: {
    flex: 1.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leftScrollView: {
    flex: 1,
  },
  rightSectionWeb: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  detailsContainerWeb: {
    flex: 1,
  },
  detailsHeaderWeb: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  detailsTitleWeb: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  detailsTabsWeb: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailsTabWeb: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  detailsTabActiveWeb: {
    borderBottomColor: '#7C3AED',
  },
  detailsTabTextWeb: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailsTabTextActiveWeb: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  detailsContentWeb: {
    flex: 1,
    padding: 20,
  },
  emptyStateWeb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitleWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateTextWeb: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Grille des cartes de factures Web
  invoicesGridWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    padding: 20,
  },
  invoiceCardWeb: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 16,
  },
  invoiceCardSelectedWeb: {
    borderColor: '#7C3AED',
    backgroundColor: '#F8FAFC',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  invoiceCardHeaderWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceCardHeaderLeftWeb: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  invoiceCardIdWeb: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  invoiceCardDateHeaderWeb: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  invoiceCardClientWeb: {
    marginBottom: 12,
  },
  invoiceCardCustomerNameWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  invoiceCardCustomerEmailWeb: {
    fontSize: 12,
    color: '#6B7280',
  },
  invoiceCardInfoWeb: {
    marginBottom: 12,
  },
  invoiceCardInfoRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  invoiceCardDateWeb: {
    fontSize: 12,
    color: '#6B7280',
  },
  invoiceCardItemsWeb: {
    fontSize: 12,
    color: '#6B7280',
  },
  invoicePaymentRowWeb: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  invoiceBadgeRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  invoiceDebtBadgeWeb: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  invoiceDebtBadgeDebtWeb: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
  },
  invoiceDebtBadgePaidWeb: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
  },
  invoiceDebtBadgeTextWeb: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  invoiceDebtBadgeTextDebtWeb: {
    color: '#B91C1C',
  },
  invoiceDebtBadgeTextPaidWeb: {
    color: '#047857',
  },
  invoicePaymentTypeContainerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  invoicePaymentTypeTextWeb: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  invoiceCardFooterWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  invoiceCardTotalsWeb: {
    alignItems: 'flex-end',
  },
  invoiceCardTotalWeb: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  invoiceCardTotalUsdWeb: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
    marginTop: 2,
  },
  invoiceCardActionWeb: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  
  
  
  // Grille de produits
  
  // Bouton de statut de facture
  statusButtonContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 16,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  statusButtonComplete: {
    backgroundColor: '#10B981',
  },
  statusButtonContinue: {
    backgroundColor: '#F59E0B',
  },
  statusButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  titleWeb: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitleWeb: {
    fontSize: 16,
    color: '#6B7280',
  },
  
  // Container Mobile
  containerMobile: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
  },
  titleMobile: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  
  // Header
  headerWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  
  // Filtres
  filtersContainerWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filtersContainerMobile: {
    marginBottom: 20,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  
  // Recherche
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
  },
  reportActionsWeb: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  reportButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  reportButtonSecondaryWeb: {
    backgroundColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
  },
  reportButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  
  // Statistiques
  statsContainerWeb: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statsContainerMobile: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCardWeb: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  statCardMobile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  statValueWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 4,
  },
  statValueMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 4,
  },
  statLabelWeb: {
    fontSize: 14,
    color: '#6B7280',
  },
  statLabelMobile: {
    fontSize: 12,
    color: '#6B7280',
  },
  reportActionsMobile: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  reportButtonMobile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
  },
  reportButtonMobileSecondary: {
    backgroundColor: '#0EA5E9',
  },
  reportButtonMobileText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Table Web
  tableContainerWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tableHeaderWeb: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  tableRowWeb: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  tableCellWeb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  customerEmail: {
    fontSize: 12,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButton: {
    padding: 4,
  },
  
  // Liste Mobile
  invoicesListMobile: {
    gap: 12,
  },
  invoiceCardMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 12,
  },
  invoiceHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  invoiceHeaderLeftMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  invoiceIdMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  invoiceDateHeaderMobile: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  clientSectionMobile: {
    marginBottom: 12,
  },
  customerNameMobile: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  customerEmailMobile: {
    fontSize: 13,
    color: '#6B7280',
  },
  invoiceInfosMobile: {
    gap: 8,
    marginBottom: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoItemMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  infoTextMobile: {
    fontSize: 13,
    color: '#6B7280',
  },
  invoiceDebtBadgeMobile: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  invoiceDebtBadgeDebtMobile: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
  },
  invoiceDebtBadgePaidMobile: {
    backgroundColor: '#ECFDF5',
    borderColor: '#34D399',
  },
  invoiceDebtBadgeTextMobile: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  invoiceDebtBadgeTextDebtMobile: {
    color: '#B91C1C',
  },
  invoiceDebtBadgeTextPaidMobile: {
    color: '#047857',
  },
  invoiceFooterMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabelMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  totalContainerMobile: {
    alignItems: 'flex-end',
  },
  invoiceTotalMobile: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  invoiceTotalUsdMobile: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  
  // Détails de facture Mobile
  invoiceDetailsMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailsHeaderMobile: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 8,
  },
  detailsTitleMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeDetailsMobile: {
    backgroundColor: '#7C3AED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  closeDetailsTextMobile: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 800,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainerMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '95%',
    height: '80%',
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
  },
  closeButton: {
    padding: 4,
  },
  closeButtonMobile: {
    backgroundColor: '#EF4444',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  closeButtonMobileText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Onglets Modal
  modalTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modalTabActive: {
    borderBottomColor: '#7C3AED',
  },
  modalTabText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalTabTextActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  
  // Contenu Modal
  modalContent: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  mobileSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
  },
  mobilePaymentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  mobilePaymentChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    marginBottom: 8,
  },
  mobilePaymentChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  mobilePaymentChipText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  mobilePaymentChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  paymentInfoTextMobile: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  paymentLabelMobile: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  paymentInputMobile: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  paymentDeviseRowMobile: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  paymentDeviseButtonMobile: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  paymentDeviseButtonActiveMobile: {
    borderColor: '#7C3AED',
    backgroundColor: '#EDE9FE',
  },
  paymentDeviseButtonTextMobile: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  paymentDeviseButtonTextActiveMobile: {
    color: '#4C1D95',
    fontWeight: '600',
  },
  paymentObservationInputMobile: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  paymentSubmitButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 8,
  },
  paymentSubmitButtonDisabledMobile: {
    backgroundColor: '#A5B4FC',
  },
  paymentSubmitButtonTextMobile: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentHistoryButtonMobile: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  paymentHistoryButtonTextMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  mobileDebtToggleRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  mobileDebtButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  mobileDebtButtonSpacing: {
    marginRight: 12,
  },
  mobileDebtButtonDebt: {
    backgroundColor: '#FEF2F2',
  },
  mobileDebtButtonPaid: {
    backgroundColor: '#ECFDF5',
  },
  mobileDebtButtonActiveDebt: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  mobileDebtButtonActivePaid: {
    borderColor: '#10B981',
    backgroundColor: '#DCFCE7',
  },
  mobileDebtButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  mobileDebtButtonTextActiveDebt: {
    color: '#B91C1C',
  },
  mobileDebtButtonTextActivePaid: {
    color: '#047857',
  },
  infosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  // Articles
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    minWidth: 60,
    textAlign: 'right',
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#FEF2F2',
  },
  
  // Total
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  paymentSectionWeb: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentInfoTextWeb: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  paymentAmountRowWeb: {
    marginBottom: 16,
  },
  paymentLabelWeb: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  paymentDeviseGroupWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  paymentDeviseButtonWeb: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  paymentDeviseButtonActiveWeb: {
    borderColor: '#7C3AED',
    backgroundColor: '#EDE9FE',
  },
  paymentDeviseButtonTextWeb: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  paymentDeviseButtonTextActiveWeb: {
    color: '#4C1D95',
    fontWeight: '600',
  },
  paymentObservationInputWeb: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
    marginBottom: 16,
  },
  paymentSubmitButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0EA5E9',
    paddingVertical: 14,
    borderRadius: 8,
  },
  paymentSubmitButtonDisabledWeb: {
    backgroundColor: '#A5B4FC',
  },
  paymentSubmitButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  paymentHistoryButtonWeb: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
  },
  paymentHistoryButtonTextWeb: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  // Produits
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: '30%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 8,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 10,
    color: '#6B7280',
  },
  
  // Produits Mobile
  productsGridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCardMobile: {
    width: '45%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  productImageMobile: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginBottom: 6,
  },
  productNameMobile: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  productPriceMobile: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7C3AED',
    marginBottom: 2,
  },
  productCategoryMobile: {
    fontSize: 10,
    color: '#6B7280',
  },
  
  // En-tête produits
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  quantityInput: {
    width: 80,
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
  },
  addToInvoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addToInvoiceButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  addToInvoiceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // En-tête produits mobile
  productHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  quantityInputContainerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityLabelMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  quantityInputMobile: {
    width: 60,
    height: 36,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
  },
  addToInvoiceButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  addToInvoiceButtonTextMobile: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Sélection de produit
  productCardSelected: {
    borderColor: '#7C3AED',
    borderWidth: 2,
    backgroundColor: '#F3F4F6',
  },
  
  // Chargement et erreurs dans la liste
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 12,
  },
  errorIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // États vides
  emptyStateMobile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 20,
  },
  emptyStateTitleMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateTextMobile: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Styles pour le mode édition
  editContainerWeb: {
    flex: 1,
    padding: 20,
  },
  editHeaderWeb: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  editTitleRowWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  editTitleWeb: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  editRateWeb: {
    fontSize: 16,
    color: '#282828',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    fontWeight: '600',
  },
  editSubtitleWeb: {
    fontSize: 14,
    color: '#6B7280',
  },
  editTabsWeb: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 4,
  },
  editTabWeb: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  editTabActiveWeb: {
    backgroundColor: '#00436C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  editTabTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  editTabTextActiveWeb: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  editContentWeb: {
    flex: 1,
  },
  editSectionWeb: {
    marginBottom: 24,
  },
  editSectionTitleWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  editSectionSubtitleWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  editPaymentContainerWeb: {
    marginTop: 8,
  },
  paymentMethodChipsWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paymentMethodChipWeb: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 8,
  },
  paymentMethodChipActiveWeb: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  paymentMethodChipTextWeb: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  paymentMethodChipTextActiveWeb: {
    color: '#4C1D95',
  },
  debtToggleContainerWeb: {
    marginTop: 16,
  },
  debtToggleOptionsWeb: {
    flexDirection: 'row',
  },
  debtToggleButtonWeb: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginRight: 8,
  },
  debtToggleButtonActiveWeb: {
    borderColor: '#7C3AED',
    backgroundColor: '#7C3AED',
  },
  debtToggleButtonTextWeb: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  debtToggleButtonTextActiveWeb: {
    color: '#FFFFFF',
  },
  editInputWeb: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  editItemRowWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  editItemInfoWeb: {
    flex: 1,
  },
  editItemNameWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  editItemPriceWeb: {
    fontSize: 12,
    color: '#6B7280',
  },
  editItemActionsWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editQuantityButtonWeb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editQuantityTextWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    minWidth: 20,
    textAlign: 'center',
  },
  editRemoveButtonWeb: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
  },
  editReductionRowWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editReductionLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  editReductionInputWeb: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    width: 100,
    textAlign: 'right',
  },
  
  // Styles pour les totaux
  editTotalRowWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  editTotalLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  editTotalValueWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  
  // Styles pour le total après réduction
  editTotalAfterReductionRowWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editTotalAfterReductionValueContainerWeb: {
    alignItems: 'flex-end',
  },
  editTotalAfterReductionLabelWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  editTotalAfterReductionValueWeb: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  editReductionDetailWeb: {
    marginTop: 4,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    textAlign: 'right',
  },
  editStatusButtonsWeb: {
    flexDirection: 'row',
    gap: 8,
  },
  editStatusButtonWeb: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  editStatusButtonActiveWeb: {
    backgroundColor: '#F3F4F6',
  },
  editStatusButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  editStatusButtonTextActiveWeb: {
    color: '#1F2937',
    fontWeight: '600',
  },
  editStatusButtonDisabledWeb: {
    opacity: 0.6,
  },
  statusActionButtonsWeb: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  statusActionButtonWeb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  statusActionButtonSecondaryWeb: {
    backgroundColor: '#6B7280',
  },
  statusActionButtonDangerWeb: {
    backgroundColor: '#EF4444',
  },
  statusActionButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  editButtonContainerWeb: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  editButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  editButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  editButtonDisabledWeb: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  
  // Styles pour le bouton d'impression
  printButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  printButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Styles pour la modal d'impression
  printModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 600,
    height: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  printModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  printModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  printModalContent: {
    flex: 1,
    padding: 20,
  },
  printSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  printSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  printInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  printInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    flex: 1,
  },
  printInfoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  printItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  printItemInfo: {
    flex: 1,
  },
  printItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  printItemDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  printItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    minWidth: 80,
    textAlign: 'right',
  },
  printTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  printTotalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  printTotalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  printTotalAfterReductionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  printTotalAfterReductionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  printTotalAfterReductionValueContainer: {
    alignItems: 'flex-end',
  },
  printTotalAfterReductionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  printReductionDetail: {
    marginTop: 4,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
    textAlign: 'right',
  },
  printModalButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  printModalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  printModalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  printModalPrintButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  printModalPrintButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  printModalPrintButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  paymentsModalContainer: {
    width: '90%',
    maxWidth: 520,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  paymentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  paymentsModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  paymentsModalContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  paymentsModalLoading: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  paymentsModalLoadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentsModalError: {
    padding: 16,
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  paymentsModalEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  paymentsModalEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  paymentHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 12,
  },
  paymentHistoryActions: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  deletePaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  deletePaymentButtonDisabled: {
    opacity: 0.7,
  },
  deletePaymentButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  paymentHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paymentHistoryLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  paymentHistoryValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  paymentHistoryObservation: {
    marginTop: 6,
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
  },
  paymentHistoryDate: {
    marginTop: 6,
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '500',
  },
  invoiceReportModalContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  invoiceReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  invoiceReportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  invoiceReportSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  invoiceReportHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  invoiceReportPrintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 10,
  },
  invoiceReportPrintButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  invoiceReportBody: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  invoiceReportIframeContainer: {
    flex: 1,
  },
  invoiceReportEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  invoiceReportEmptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  invoiceReportScroll: {
    flex: 1,
  },
  invoiceReportScrollContent: {
    padding: 20,
    gap: 16,
  },
  invoiceReportStatsMobileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  invoiceReportStatsMobileCard: {
    width: '48%',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  invoiceReportStatsMobileLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  invoiceReportStatsMobileValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  invoiceReportListMobile: {
    gap: 12,
  },
  invoiceReportItemMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  invoiceReportItemHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceReportItemTitleMobile: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  invoiceReportBadgeMobile: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  invoiceReportBadgeTextMobile: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4338CA',
    textTransform: 'uppercase',
  },
  invoiceReportItemRowMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  invoiceReportItemLabelMobile: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  invoiceReportItemValueMobile: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '500',
    marginLeft: 12,
    textAlign: 'right',
    flexShrink: 1,
  },
  invoiceReportProductsMobile: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    gap: 10,
  },
  invoiceReportProductsTitleMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  invoiceReportProductRowMobile: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  invoiceReportProductHeaderMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceReportProductNameMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  invoiceReportProductQtyMobile: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4C1D95',
    marginLeft: 12,
  },
  invoiceReportProductAmountsMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceReportProductAmountMobile: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  invoiceReportProductAmountSecondaryMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  invoiceReportMobileFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  
  // Styles pour l'onglet produits
  productHeaderWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quantityInputContainerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginRight: 8,
  },
  quantityInputWeb: {
    width: 60,
    height: 32,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  resetQuantityButtonWeb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addToInvoiceButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addToInvoiceButtonDisabledWeb: {
    backgroundColor: '#D1D5DB',
  },
  addToInvoiceButtonTextWeb: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  categorySelectorWeb: {
    marginBottom: 16,
  },
  categoryLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  categoryButtonsWeb: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButtonWeb: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryButtonActiveWeb: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryButtonTextWeb: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryButtonTextActiveWeb: {
    color: '#FFFFFF',
  },
  productsGridWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCardWeb: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  productCardSelectedWeb: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  checkIconContainerWeb: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  productCardContentWeb: {
    marginTop: 8,
  },
  productNameWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  productCategoryWeb: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  productPriceWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  productPriceContainerWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  productPriceCdfWeb: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  productStockWeb: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  
  // Styles pour les indicateurs de chargement et d'erreur
  loadingContainerWeb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingTextWeb: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorContainerWeb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTextWeb: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  
  // Styles pour l'état vide des produits
  emptyProductsWeb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    width: '100%',
  },
  emptyProductsTextWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyProductsSubtextWeb: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Styles pour les produits en rupture de stock
  productCardOutOfStockWeb: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    opacity: 0.7,
  },
  productCardOutOfStockMobile: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    opacity: 0.7,
  },
  productStockOutOfStockWeb: {
    color: '#DC2626',
    fontWeight: '600',
  },
  productStockOutOfStockMobile: {
    color: '#DC2626',
    fontWeight: '600',
  },
  productStockMobile: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Date filter styles
  dateFilterContainer: {
    marginBottom: 16,
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateRangeText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
  },
  dateFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 4,
  },
  dateFilterButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateInputGroup: {
    marginBottom: 16,
  },
  dateInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 14,
    color: '#374151',
  },
  datePickerButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  datePickerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  resetDateButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
  },
  resetDateButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  applyDateButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  applyDateButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Editable date input styles
  dateInputEditing: {
    borderColor: '#3B82F6',
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  dateInputHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  
  // Styles pour les boutons de sélection de date web
  webDateSelectionContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  webDateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  webDateButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  
  // Styles pour les boutons de sélection de date mobile
  mobileDateSelectionContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  mobileDateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 4,
  },
  mobileDateButtonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Styles pour les onglets mobiles
  mobileTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  mobileTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mobileTabActive: {
    borderBottomColor: '#7C3AED',
    backgroundColor: '#FFFFFF',
  },
  mobileTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 6,
  },
  mobileTabTextActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },

  // Styles pour l'onglet produits
  productsScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  categoryFilterContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  categoryFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryFilterButtonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  categoryFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mobileProductCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mobileProductInfo: {
    flex: 1,
    marginRight: 12,
  },
  mobileProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  mobileProductPrice: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  mobileProductCategory: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  mobileAddProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    gap: 4,
  },
  mobileAddProductButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Styles pour les articles modifiables dans l'onglet Détails
  mobileEditableItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mobileEditableItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  mobileEditableItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  mobileEditableItemPrice: {
    fontSize: 12,
    color: '#6B7280',
  },
  mobileEditableItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileQuantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileQuantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    minWidth: 20,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  mobileDeleteItemButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Styles pour la sélection de produit
  productSelectionContainer: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#7C3AED',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  productSelectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  cancelSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
  },
  cancelSelectionText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  
  // Styles pour les actions de facture mobile
  mobileInvoiceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  mobileActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  mobileActionButtonPrimary: {
    backgroundColor: '#3B82F6',
  },
  mobileActionButtonDanger: {
    backgroundColor: '#EF4444',
  },
  mobileActionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  
});

export default FactureComponent;
