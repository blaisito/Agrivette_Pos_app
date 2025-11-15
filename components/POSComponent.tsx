import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getCategories } from '../api/categoryApi';
import { getExchangeRate } from '../api/configurationApi';
import { createFacture, printFacture } from '../api/factureApi';
import { getProducts } from '../api/productApi';
import { getTableById, getTables } from '../api/tableApi';
import { useFetch } from '../hooks/useFetch';
import { getUserData } from '../utils/storage';

// Vérifier que l'import fonctionne

// Fonction utilitaire pour les alertes compatibles web/mobile
const showAlert = (title: string, message: string) => {
  if (typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Fonction pour formater les données de facture POS en format de reçu
const formatInvoiceForReceiptPOS = (orderItems: any[], selectedTable: any, customerName: string, customerContact: string, paymentMethod: string, totalCdf: number, totalUsd: number, totalUsdInCdf: number, discount: number, exchangeRate: number) => {
  const factureDate = new Date().toISOString();
  
  // Mapper les orderItems vers items (même structure que FactureComponent)
  const items = orderItems.map((item, index) => ({
    productName: item.name || "Produit",
    price: item.price || 0, // Prix unitaire CDF
    qte: item.quantity || 1,
    total: (item.price || 0) * (item.quantity || 1) // Total calculé
  }));
  
  // Calculer le total final avec réduction
  const finalTotalCdf = totalCdf + totalUsdInCdf - discount;
  
  return {
    // ENTÊTE RESTAURANT (identique à FactureComponent)
    organisationName: "AGRIVET-CONGO",
    adresse1: "611b av des chutes",
    adresse2: "Lubumbashi, RDC",
    phone1: "(+243) 000-000-0000",
    phone2: "(+243) 000-000-0000",
    rccm: "RCCM ********",
    idOrganisation: "ID.NAT.********",
    numeroImpot: "NUMERO IMPOT, ********",
    logoPath: "images/logo.png",
    
    // INFORMATIONS FACTURE
    tableName: selectedTable ? (selectedTable.nomination || `Table ${selectedTable.id}`) : "N/A",
    date: factureDate,
    time: factureDate, // Même valeur que date
    
    // ARTICLES (format identique à FactureComponent)
    items: items,
    
    // TOTAUX (clés identiques)
    total: finalTotalCdf,
    netTotal: totalUsd,
    
    // MESSAGE FINAL
    thanksMessage: "Thank you for your business! Come again soon!"
  };
};

// Fonction pour imprimer une facture dans le POS
const handlePrintFacturePOS = async (receiptData: any) => {
  try {
    await printFacture(receiptData);
    Alert.alert('Succès', 'Facture envoyée à l\'imprimante avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de l\'impression:', error);
    Alert.alert('Erreur d\'impression', 'Impossible d\'imprimer la facture. Vérifiez la connexion à l\'imprimante.');
  }
};

// Interface pour les props du composant POS
interface POSComponentProps {
  onCartItemCountChange?: (count: number) => void;
}

// Composant POS (Point of Sale)
const POSComponent = ({ onCartItemCountChange }: POSComponentProps) => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 868; // Tablette = 768px, donc > 768px = desktop/large screen
  
  const [orderItems, setOrderItems] = useState<any[]>([]);

  // Notifier le composant parent du nombre d'articles dans le panier
  useEffect(() => {
    if (onCartItemCountChange) {
      const totalItems = orderItems.reduce((total, item) => total + item.quantity, 0);
      onCartItemCountChange(totalItems);
    }
  }, [orderItems, onCartItemCountChange]);

  const [userId, setUserId] = useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const depotCode = userData?.depotCode ?? null;
  const productFetchParams = useMemo(
    () => (depotCode ? { depotCode } : null),
    [depotCode]
  );

  // Hooks pour les données API
  const { data: categoriesData, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useFetch(getCategories);
  const { data: productsData, loading: productsLoading, error: productsError, refetch: refetchProducts } = useFetch(getProducts, productFetchParams as any);
  const { data: tablesData, loading: tablesLoading, error: tablesError, refetch: refetchTables } = useFetch(getTables);
  
  // Types pour éviter les erreurs TypeScript
  const categories = categoriesData || [];
  const products = productsData || [];
  const tables = tablesData || [];


  // États pour la modal du panier
  const [showCartModal, setShowCartModal] = useState(false);
  const [discount, setDiscount] = useState('');
  const [amountCdf, setAmountCdf] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [useUsdAmounts, setUseUsdAmounts] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isDebt, setIsDebt] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [commandNotice, setCommandNotice] = useState('');
  const [keypadValue, setKeypadValue] = useState('');

  // États pour la modal de sélection de table
  const [showTableModal, setShowTableModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  

  // État pour la recherche de produits
  const [searchTerm, setSearchTerm] = useState('');
  
  // État pour la sélection de catégorie
  const [selectedCategory, setSelectedCategory] = useState('Toutes');
  
  // État pour les produits sélectionnés
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // État pour le loading du refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // État pour compter les secondes de chargement
  const [loadingSeconds, setLoadingSeconds] = useState(0);

  // État pour les détails de la table sélectionnée
  const [selectedTableDetails, setSelectedTableDetails] = useState<any>(null);
  const [loadingTableDetails, setLoadingTableDetails] = useState(false);

  // État pour la devise de chaque item du panier (true = USD, false = CDF)
  const [currencyPerItem, setCurrencyPerItem] = useState<boolean[]>([]);

  // État pour le taux de change
  const [exchangeRate, setExchangeRate] = useState<number>(2850); // Valeur par défaut
  
  // État pour le chargement de la création de facture
  const [isCreatingFacture, setIsCreatingFacture] = useState<boolean>(false);
  
  // État pour afficher un overlay de chargement global
  const [showLoadingOverlay, setShowLoadingOverlay] = useState<boolean>(false);

  useEffect(() => {
    if (useUsdAmounts) {
      setAmountCdf('');
    } else {
      setAmountUsd('');
    }
  }, [useUsdAmounts]);

  const clampNumericInput = (rawValue: string, maxValue: number, decimals = 2) => {
    if (rawValue.trim() === '') {
      return '';
    }
    const sanitized = rawValue.replace(',', '.');
    const parsed = Number(sanitized);
    if (Number.isNaN(parsed)) {
      return null;
    }
    const clamped = Math.max(0, Math.min(parsed, maxValue));
    return decimals === 0 ? Math.round(clamped).toString() : clamped.toFixed(decimals);
  };

const getPriceForCurrency = (item: any, isUsd: boolean, rate: number) => {
  const basePriceUsd =
    typeof item.basePriceUsd === 'number'
      ? item.basePriceUsd
      : typeof item.priceUsd === 'number' && item.priceUsd > 0
      ? item.priceUsd
      : (() => {
          const priceCdf = typeof item.priceCdf === 'number' ? item.priceCdf : 0;
          return rate > 0 ? priceCdf / rate : 0;
        })();

  if (isUsd) {
    return basePriceUsd;
  }

  return basePriceUsd * (rate || 0);
};

  const handleAmountCdfChange = (value: string) => {
    if (useUsdAmounts) {
      setAmountCdf('');
      return;
    }
    const maxValue = Math.max(0, total);
    const result = clampNumericInput(value, maxValue, 0);
    if (result !== null) {
      setAmountCdf(result);
    }
  };

  const handleAmountUsdChange = (value: string) => {
    if (!useUsdAmounts) {
      setAmountUsd('');
      return;
    }
    const maxValue = Math.max(0, totalFinalUsd);
    // Laisser la saisie libre tant que <= max et numérique
    if (value.trim() === '') {
      setAmountUsd('');
      return;
    }
    const sanitized = value.replace(',', '.');
    const parsed = Number(sanitized);
    if (Number.isNaN(parsed)) {
      // Ne rien faire si ce n'est pas un nombre valide
      return;
    }
    const clamped = Math.min(Math.max(parsed, 0), maxValue);
    if (parseFloat(parsed.toFixed(2)) !== parseFloat(clamped.toFixed(2))) {
      setAmountUsd(clamped.toFixed(2));
    } else {
      setAmountUsd(value);
    }
  };
  // Charger les données utilisateur au démarrage
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = await getUserData();
        if (user && user.id) {
          setUserData(user);
          setUserId(user.id);
        } else {
          console.error('❌ Pas d\'utilisateur connecté ou ID manquant');
          Alert.alert('Erreur', 'Aucun utilisateur connecté. Veuillez vous reconnecter.');
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement des données utilisateur:', error);
        Alert.alert('Erreur', 'Erreur lors du chargement des données utilisateur.');
      }
    };

    loadUserData();
  }, []);

  // Fonction pour charger le taux de change depuis l'API
  const loadExchangeRate = async () => {
    try {
      const rate = await getExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.error('Erreur lors du chargement du taux de change:', error);
      // Garder la valeur par défaut en cas d'erreur
    }
  };

  // Charger le taux de change au montage du composant
  React.useEffect(() => {
    loadExchangeRate();
  }, []);

  // Actualiser le taux de change à chaque fois que la vue POS s'affiche
  React.useEffect(() => {
    if (selectedTable) {
      loadExchangeRate();
    }
  }, [selectedTable]);

  // Fonction pour sélectionner une table et récupérer ses détails
  const handleTableSelection = useCallback(async (table: any) => {
    setSelectedTable(table);
    setLoadingTableDetails(true);
    
    try {
      const tableDetails = await getTableById(table.id);
      setSelectedTableDetails(tableDetails.data);
    } catch (error) {
      console.error('Erreur lors de la récupération des détails de la table:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les détails de la table');
    } finally {
      setLoadingTableDetails(false);
    }
  }, []);

  useEffect(() => {
    if (tables.length === 0) {
      return;
    }

    const tableStillAvailable =
      selectedTable && tables.some((table: any) => table.id === selectedTable.id);

    if (!tableStillAvailable) {
      handleTableSelection(tables[0]);
    }
  }, [tables, selectedTable, handleTableSelection]);

  // Calcul des totaux par devise
  const totalCdf = orderItems.reduce((sum, item, index) => {
    return currencyPerItem[index] ? sum : sum + item.total;
  }, 0);
  
  const totalUsd = orderItems.reduce((sum, item, index) => {
    return currencyPerItem[index] ? sum + item.total : sum;
  }, 0);
  
  const totalUsdInCdf = totalUsd * exchangeRate;
  const grossTotalCdf = totalCdf + totalUsdInCdf;

  const discountValue = parseFloat(discount) || 0;
  const appliedReductionUsd = useUsdAmounts ? Math.min(discountValue, totalUsd) : 0;
  const appliedReductionCdf = useUsdAmounts ? 0 : Math.min(discountValue, grossTotalCdf);

  const adjustedTotalUsd = Math.max(0, totalUsd - appliedReductionUsd);
  const adjustedTotalUsdInCdf = adjustedTotalUsd * exchangeRate;

  const subtotal = grossTotalCdf;
  const totalCdfAfterDiscount = useUsdAmounts
    ? totalCdf + adjustedTotalUsdInCdf
    : Math.max(0, grossTotalCdf - appliedReductionCdf);

  const tax = subtotal * 0.13; // 13% de taxe (pour affichage seulement)
  const total = totalCdfAfterDiscount; // Total final en CDF après réduction
  const totalFinalUsd = total / exchangeRate; // Total final en USD
  const displayReductionCdf = appliedReductionCdf;
  const displayReductionUsd = appliedReductionUsd;
  const totalUsdDisplay = adjustedTotalUsd;
  const totalUsdInCdfDisplay = useUsdAmounts ? adjustedTotalUsdInCdf : totalUsdInCdf;

  // Ajout d'images pour chaque item du menu
  const menuItems = [
    {
      name: 'SIMBA Beer',
      price: 8.63,
      category: 'Boisson',
      image: 'https://th.bing.com/th/id/R.73f863579a37608df9d52a4faad563cc?rik=7xDeJbcPRYRQ%2fQ&pid=ImgRaw&r=0'
    },
    {
      name: 'CASTLE Beer',
      price: 8.05,
      category: 'Boisson',
      image: 'https://tse2.mm.bing.net/th/id/OIP.jgD_Xqvy4PGJNUZj--eb1AHaJo?rs=1&pid=ImgDetMain&o=7&rm=3'
    },
    {
      name: 'JACK DANIEL S Single Barrel 45% Heritage Whisky',
      price: 3.45,
      category: 'Alcool',
      image: 'https://th.bing.com/th/id/R.0c93f8c9a0f329837b0c0e4dd6c1638c?rik=DOy%2f4Hqk982h7Q&pid=ImgRaw&r=0'
    },
    {
      name: 'Amarula 375ml | Bar Keeper',
      price: 3.91,
      category: 'Alcool',
      image: 'https://tse2.mm.bing.net/th/id/OIP.UjgVJ9ce4zcwOwr8LxKKSAHaHa?rs=1&pid=ImgDetMain&o=7&rm=3'
    },
    {
      name: 'Bottle of Wine - Pentax',
      price: 8.05,
      category: 'Alcool',
      image: 'https://th.bing.com/th/id/R.ac87a3e239a5a5cbab14d3d71d9a9d33?rik=CGoRSZcqluHCOw&riu=http%3a%2f%2fwww.pentaxforums.com%2fgallery%2fimages%2f5744%2f1_Bottle_of_Wine.jpg&ehk=ww9dq%2bY7zYhW6Yn89ijLNr8yTbJzqPkJ2QHY7me2uxg%3d&risl=&pid=ImgRaw&r=0'
    },
    {
      name: 'Lunch M 18pc',
      price: 13.80,
      category: 'Sushi',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Lunch Salmon 20pc',
      price: 15.87,
      category: 'Sushi',
      image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Lunch Temaki mix 3pc',
      price: 16.10,
      category: 'Sushi',
      image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Margherita',
      price: 8.05,
      category: 'Pizza',
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Mozzarella Sandwich',
      price: 4.49,
      category: 'Sandwich',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Pasta 4 formaggi',
      price: 6.33,
      category: 'Pasta',
      image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0723c6a?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Pasta Bolognese',
      price: 5.18,
      category: 'Pasta',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Salmon and Avocado',
      price: 10.64,
      category: 'Sushi',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Spicy Tuna Sandwich',
      price: 3.45,
      category: 'Sandwich',
      image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Vegetarian',
      price: 8.05,
      category: 'Pizza',
      image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80'
    },
    // Quelques boissons
    {
      name: 'Ice Tea',
      price: 2.53,
      category: 'Boisson',
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'
    },
    {
      name: 'Coca-Cola',
      price: 2.00,
      category: 'Boisson',
      image: 'https://tse3.mm.bing.net/th/id/OIP.UhLiDYoAoCDoeiMyy8tYwgHaHa?w=840&h=840&rs=1&pid=ImgDetMain&o=7&rm=3'
    },
    {
      name: 'Eau minérale',
      price: 1.50,
      category: 'Boisson',
      image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80'
    }
  ];

  // État pour gérer la liste des produits affichés
  const [displayedMenuItems, setDisplayedMenuItems] = useState(menuItems);

  // Liste des catégories depuis l'API
  const apiCategories = ['Toutes', ...categories.map((cat: any) => cat.categoryName)];

  // Fonction de filtrage des produits depuis l'API
  const filteredMenuItems = products.filter((product: any) => {
    const matchesSearch = product.productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Toutes' || product.category?.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Fonction pour actualiser les produits et catégories
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLoadingSeconds(0);
    
    // Afficher une liste vide d'abord
    setDisplayedMenuItems([]);
    
    // Démarrer le compteur de secondes
    const interval = setInterval(() => {
      setLoadingSeconds(prev => prev + 1);
    }, 1000);
    
    // Simuler un délai de chargement de 3 secondes (dans une vraie app, ce serait un appel API)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Arrêter le compteur
    clearInterval(interval);
    
    // Réafficher les produits
    setDisplayedMenuItems(menuItems);
    
    // Réinitialiser les filtres et sélections
    setSearchTerm('');
    setSelectedCategory('Toutes');
    setSelectedProducts(new Set());
    
    setIsRefreshing(false);
    setLoadingSeconds(0);
  };


  // Fonction pour supprimer un item du panier
  const removeItemFromCart = (index: number) => {
    const itemToRemove = orderItems[index];
    setOrderItems(prev => prev.filter((_, i) => i !== index));
    
    // Supprimer aussi la devise correspondante
    setCurrencyPerItem(prev => prev.filter((_, i) => i !== index));
    
    // Désélectionner le produit visuellement
    if (itemToRemove) {
      setSelectedProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemToRemove.name);
        return newSet;
      });
    }
  };

  // Fonction pour augmenter la quantité d'un article
  const increaseQuantity = (index: number) => {
    const newItems = [...orderItems];
    newItems[index].quantity += 1;
    const isUsd = currencyPerItem[index];
    const price = getPriceForCurrency(newItems[index], isUsd, exchangeRate);
    newItems[index].price = price;
    newItems[index].total = newItems[index].quantity * price;
    setOrderItems(newItems);
  };

  // Fonction pour diminuer la quantité d'un article
  const decreaseQuantity = (index: number) => {
    const newItems = [...orderItems];
    if (newItems[index].quantity > 1) {
      newItems[index].quantity -= 1;
      const isUsd = currencyPerItem[index];
      const price = getPriceForCurrency(newItems[index], isUsd, exchangeRate);
      newItems[index].price = price;
      newItems[index].total = newItems[index].quantity * price;
      setOrderItems(newItems);
    }
  };

  // Fonction pour changer la devise d'un item
  const toggleCurrency = (index: number) => {
    const newCurrencyPerItem = [...currencyPerItem];
    newCurrencyPerItem[index] = !newCurrencyPerItem[index];
    setCurrencyPerItem(newCurrencyPerItem);
    
    // Mettre à jour le prix et total de l'item
    const newItems = [...orderItems];
    const isUsd = newCurrencyPerItem[index];
    const price = getPriceForCurrency(newItems[index], isUsd, exchangeRate);
    newItems[index].price = price;
    newItems[index].total = newItems[index].quantity * price;
    setOrderItems(newItems);
  };

  // Fonction pour ajouter un produit directement au panier
  const addProductToCart = (product: any) => {
    // Ajouter le produit au panier
    const basePriceUsd = Number(product.priceUsd || 0);
    const initialCurrencyIsUsd = true;
    const initialPrice = getPriceForCurrency(
      { basePriceUsd },
      initialCurrencyIsUsd,
      exchangeRate
    );
    const newItem = {
      id: product.id, // ⚠️ Ajouter l'ID du produit
      productId: product.id, // ⚠️ Ajouter aussi productId pour compatibilité
      name: product.productName,
      quantity: 1,
      price: initialPrice,
      total: initialPrice,
      basePriceUsd,
    };
    
    setOrderItems(prev => [...prev, newItem]);
    
    // Initialiser la devise à USD (true) pour le nouvel item
    setCurrencyPerItem(prev => [...prev, initialCurrencyIsUsd]);
    
    // Marquer le produit comme sélectionné
    setSelectedProducts(prev => new Set([...prev, product.productName]));
  };

  // Fonction pour gérer les touches du clavier
  const handleKeypadPress = (key: string | number) => {
    if (key === '+/-') {
      // Toggle signe positif/négatif
      setKeypadValue(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev);
    } else if (key === '.') {
      // Ajouter un point décimal s'il n'y en a pas déjà
      if (!keypadValue.includes('.')) {
        setKeypadValue(prev => prev + '.');
      }
    } else {
      // Ajouter le chiffre
      setKeypadValue(prev => prev + key.toString());
    }

    // Mettre à jour le champ réduction avec la valeur du clavier
    const newValue = keypadValue + key.toString();
    setDiscount(newValue);
  };

  // Fonction pour valider la commande (mobile)
  const handleValidateOrder = () => {
    const orderDetails = orderItems.map((item, index) => {
      const isUsd = currencyPerItem[index];
      const currency = isUsd ? 'USD' : 'CDF';
      return `• ${item.name} (${item.quantity}x) - ${item.total.toFixed(2)} ${currency}`;
    }).join('\n');
    
    const finalTotal = total;
    const totalCdfAmount = totalCdf;
    const totalUsdAmount = totalUsdDisplay;
    const totalUsdInCdfAmount = totalUsdInCdfDisplay;
    const discountText =
      displayReductionCdf > 0 || displayReductionUsd > 0
        ? useUsdAmounts
          ? `\nRéduction: -${displayReductionUsd.toFixed(2)} USD`
          : `\nRéduction: -${displayReductionCdf.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF`
        : '';
    
    const confirmationMessage = `DÉTAILS DE LA FACTURE:\n\nTable: ${selectedTable ? (selectedTable.nomination || `Table ${selectedTable.id}`) : 'Non sélectionnée'}\nTaux: ${exchangeRate}\n\nARTICLES:\n${orderDetails}\n\nTOTAL CDF: ${totalCdfAmount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF\nTOTAL USD: ${totalUsdAmount.toFixed(2)} USD\nTOTAL USD en CDF: ${totalUsdInCdfAmount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF${discountText}\n\nTOTAL FINAL: ${finalTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF\nTOTAL FINAL USD: ${totalFinalUsd.toFixed(2)} USD\n\nClient: ${customerName || 'Non spécifié'}\nContact: ${customerContact || 'Non spécifié'}\nPaiement: ${paymentMethod}\n\nVoulez-vous créer cette facture ?`;
    
    Alert.alert(
      'Confirmation de facture',
      confirmationMessage,
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: isCreatingFacture ? 'Création en cours...' : 'Créer la facture',
          style: 'default',
          onPress: () => createFactureFromOrder(),
        },
      ]
    );
  };

  // Fonction pour créer la facture via l'API
  const createFactureFromOrder = async () => {
    // Éviter les appels multiples
    if (isCreatingFacture) {
      return;
    }
    
    setIsCreatingFacture(true);
    setShowLoadingOverlay(true);
    
    try {
      // Vérifier qu'on a une table sélectionnée
      if (!selectedTable) {
        showAlert('❌ Erreur', 'Veuillez sélectionner une table avant de créer la facture.');
        setIsCreatingFacture(false);
        return;
      }

      // Vérifier qu'on a un utilisateur connecté
      if (!userId) {
        showAlert('❌ Erreur', 'Aucun utilisateur connecté. Veuillez vous reconnecter.');
        setIsCreatingFacture(false);
        return;
      }

      // Transformer les orderItems en format ventes pour l'API
      const ventes = orderItems.map((item, index) => {
        // Déterminer la devise sélectionnée pour cet item
        const isUsd = currencyPerItem[index] === true;
        
        // Utiliser item.productId ou item.id selon ce qui existe
        const productId = item.productId || item.id;
        
        if (!productId) {
          console.error(`❌ Pas de productId pour l'item ${index}:`, item);
          throw new Error(`Pas de productId pour l'item: ${item.name}`);
        }
        
        // Si la devise est USD, envoyer priceUsd avec la valeur et priceCdf = 0
        // Si la devise est CDF, envoyer priceCdf avec la valeur et priceUsd = 0
        let priceUsd = 0;
        let priceCdf = 0;
        
        const basePriceUsd = Number(item.basePriceUsd ?? item.priceUsd ?? 0);
        if (isUsd) {
          priceUsd = basePriceUsd;
          priceCdf = 0;
        } else {
          priceUsd = 0;
          priceCdf = basePriceUsd * (exchangeRate || 0);
        }
        
        return {
          productId: productId,
          depotCode: depotCode,
          qte: item.quantity,
          taux: exchangeRate, // Taux affiché à côté de la table
          priceUsd: priceUsd, // Prix USD (0 si devise CDF sélectionnée)
          priceCdf: priceCdf // Prix CDF (0 si devise USD sélectionnée)
        };
      });

      // Préparer les données de la facture (ordre exact comme dans le cURL)
      const inputAmountCdf = Number((amountCdf || '0').replace(',', '.'));
      const inputAmountUsd = Number((amountUsd || '0').replace(',', '.'));

      const factureData = {
        tableId: selectedTable.id,
        userId: userId,
        reductionCdf: displayReductionCdf,
        reductionUsd: displayReductionUsd,
        amountCdf: useUsdAmounts ? 0 : inputAmountCdf,
        amountUsd: useUsdAmounts ? inputAmountUsd : 0,
        client: customerName || "", // Envoyer chaîne vide si vide
        contact: customerContact || "", // Envoyer chaîne vide si vide
        description: commandNotice || "", // Envoyer chaîne vide si vide
        status: 0, // Par défaut
        //dette: !!isDebt,
        typePaiement: paymentMethod || 'Cash',
        ventes: ventes // Ventes en dernier comme dans le cURL
      };

      console.log('factureData', factureData);

      // Appeler l'API pour créer la facture
      const response = await createFacture(factureData);
      
      if (response.success) {
        
        // Préparer les données pour l'impression AVANT de réinitialiser le panier
        const receiptDiscount = useUsdAmounts ? 0 : displayReductionCdf;
        const receiptData = formatInvoiceForReceiptPOS(
          orderItems,
          selectedTable,
          customerName,
          customerContact,
          paymentMethod,
          totalCdf,
          totalUsdDisplay,
          totalUsdInCdfDisplay,
          receiptDiscount,
          exchangeRate
        );
        
        // Réinitialiser le panier et les états
        setOrderItems([]);
        setCurrencyPerItem([]);
        setShowCartModal(false);
        setDiscount('');
        setAmountCdf('');
        setAmountUsd('');
        setUseUsdAmounts(false);
        setCustomerName('');
        setCustomerContact('');
        setPaymentMethod('Cash');
        setIsDebt(false);
        setCommandNotice('');
        setSelectedProducts(new Set());
        
        // Message de succès détaillé
        const factureNumber = response.data?.id || 'N/A';
        const totalAmount = total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        
        const successMessage = `✅ FACTURE CRÉÉE AVEC SUCCÈS !

Facture #${factureNumber}

Table: ${selectedTable?.nomination || `Table ${selectedTable?.id}`}
Client: ${customerName || 'Non spécifié'}
Total: ${totalAmount} CDF

La facture a été enregistrée dans le système.`;

        showAlert('✅ Facture créée avec succès !', successMessage);
        
        // Rafraîchir la liste des produits pour mettre à jour le stock
        refetchProducts();

        // Lancer l'impression automatique de la facture
        try {
          await handlePrintFacturePOS(receiptData);
        } catch (printError) {
          // L'erreur d'impression est déjà gérée dans l'alert de handlePrintFacturePOS
        }
      } else {
        
        const errorMessage = `❌ ERREUR LORS DE LA CRÉATION

${response.message || 'Une erreur est survenue lors de la création de la facture.'}

Veuillez réessayer.`;

        showAlert('❌ Erreur lors de la création', errorMessage);
      }
    } catch (error) {
      console.error('💥 Erreur lors de la création de la facture:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      
      const networkErrorMessage = `💥 ERREUR DE CONNEXION

Impossible de créer la facture.

Erreur: ${errorMessage}

Vérifiez votre connexion internet et réessayez.`;

      showAlert('💥 Erreur de connexion', networkErrorMessage);
    } finally {
      setIsCreatingFacture(false);
      setShowLoadingOverlay(false);
    }
  };

  // Fonction pour créer un message d'alerte formaté avec les détails de facturation
  const createFormattedInvoiceMessage = () => {
    const finalTotal = total;
    const totalCdfAmount = totalCdf;
    const totalUsdAmount = totalUsdDisplay;
    const totalUsdInCdfAmount = totalUsdInCdfDisplay;
    const discountLine =
      displayReductionCdf > 0 || displayReductionUsd > 0
        ? useUsdAmounts
          ? `\n💰 Réduction: -${displayReductionUsd.toFixed(2)} USD`
          : `\n💰 Réduction: -${displayReductionCdf.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF`
        : '';
    
    // Créer le détail des articles formatté
    const orderDetails = orderItems.map((item, index) => {
      const isUsd = currencyPerItem[index];
      const currency = isUsd ? 'USD' : 'CDF';
      const formattedTotal = isUsd ? item.total.toFixed(2) : item.total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `• ${item.name} (${item.quantity}x) - ${formattedTotal} ${currency}`;
    }).join('\n');
    
    return `AGRIVET-CONGO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 RÉCAPITULATIF DE COMMANDE

🏷️ Table: ${selectedTable ? (selectedTable.nomination || `Table ${selectedTable.id}`) : 'Non sélectionnée'}
💱 Taux de change: ${exchangeRate}

📝 ARTICLES:
${orderDetails}

💰 TOTAL CDF: ${totalCdfAmount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF
💰 TOTAL USD: ${totalUsdAmount.toFixed(2)} USD
💰 TOTAL USD en CDF: ${totalUsdInCdfAmount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF${discountLine}

🎯 TOTAL FINAL: ${finalTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} CDF
🎯 TOTAL FINAL USD: ${totalFinalUsd.toFixed(2)} USD

👤 Client: ${customerName || 'Non spécifié'}
📞 Contact: ${customerContact || 'Non spécifié'}
💳 Paiement: ${paymentMethod}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Appuyer sur "Créer & Imprimer" pour procéder à la facturation et à l'impression automatique de la facture.`;
  };

  // Web: confirmation quand on clique sur "Total facture" (desktop/web seulement)
  const handleConfirmPaymentWeb = () => {
    const message = createFormattedInvoiceMessage();

    // Utiliser confirm() sur web si disponible, sinon fallback Alert
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(message);
      if (!confirmed) return;

      // Créer la facture via l'API
      createFactureFromOrder();
      return;
    }

    // Fallback mobile/native
    Alert.alert('📋 Confirmation & Impression', message, [
      { text: '❌ Annuler', style: 'cancel' },
      { text: '✅ Créer & Imprimer', style: 'default', onPress: () => createFactureFromOrder() }
    ]);
  };


  const isTableSelected = Boolean(selectedTable);

  // Version Desktop/Large Screen
  if (isLargeScreen) {

    return (
      <View style={styles.containerWeb}>

        {/* Header avec bouton retour */}
        <View style={styles.posHeaderWeb}>
          <TouchableOpacity 
            style={styles.backToTableButton}
            onPress={() => setShowTableModal(true)}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            <Text style={styles.backToTableButtonText}>Changer de poste</Text>
          </TouchableOpacity>
          <View style={styles.posHeaderInfo}>
            <Text style={styles.posHeaderTitle}>
              POS - {selectedTable ? (selectedTable.nomination || `Table ${selectedTable.id}`) : 'Table non sélectionnée'} | Taux: {exchangeRate}
            </Text>
            <Text style={styles.posHeaderSubtitle}>
              {selectedTable ? (selectedTable.description || 'Poste disponible') : ''}
            </Text>
          </View>
        </View>

        <View style={styles.mainContentWeb}>
          
          {/* Panneau droit - Menu des produits */}
          <View style={styles.menuPanelWeb}>
            {/* États de chargement et erreurs */}
            {(categoriesLoading || productsLoading) && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Chargement des produits...</Text>
              </View>
            )}

            {(categoriesError || productsError) && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                <Text style={styles.errorText}>{categoriesError || productsError}</Text>
                <TouchableOpacity 
                  style={styles.retryButton} 
                  onPress={() => {
                    refetchCategories();
                    refetchProducts();
                  }}
                >
                  <Text style={styles.retryButtonText}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {!categoriesLoading && !productsLoading && !categoriesError && !productsError && (
              <>
                <View style={styles.searchBarContainerWeb}>
                  <View style={styles.searchBarWeb}>
                    <Ionicons name="search" size={20} color="#6B7280" />
                    <TextInput
                      placeholder="Rechercher un produit"
                      style={styles.searchInputWeb}
                      placeholderTextColor="#9CA3AF"
                      value={searchTerm}
                      onChangeText={setSearchTerm}
                    />
                  </View>
              <TouchableOpacity 
                style={styles.refreshButtonWeb}
                onPress={handleRefresh}
                disabled={isRefreshing}
              >
                <Ionicons 
                  name={isRefreshing ? "refresh" : "refresh-outline"} 
                  size={20} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
            </View>
            
            {/* Sélecteur de catégories - Desktop */}
            <View style={styles.categorySelectorWeb}>
              <Text style={styles.categoryLabelWeb}>Catégorie:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryButtonsWeb}>
                  {apiCategories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButtonWeb,
                        selectedCategory === category && styles.categoryButtonActiveWeb
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text style={[
                        styles.categoryButtonTextWeb,
                        selectedCategory === category && styles.categoryButtonTextActiveWeb
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <ScrollView>
              {displayedMenuItems.length === 0 && isRefreshing ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator size="large" color="#00436C" />
                  <Text style={styles.loadingText}>Chargement des produits...</Text>
                  <Text style={styles.loadingSeconds}>{loadingSeconds}s / 3s</Text>
                </View>
              ) : (
                <View style={styles.menuGrid}>
                  {filteredMenuItems.map((product: any, index: number) => {
                    const isOutOfStock = (product.inStock || 0) === 0;
                    return (
                      <TouchableOpacity
                        key={product.id || index}
                        style={[
                          styles.menuItemWeb,
                          selectedProducts.has(product.productName) && styles.menuItemSelected,
                          isOutOfStock && styles.menuItemDisabled
                        ]}
                        onPress={() => {
                          if (!isOutOfStock) {
                            addProductToCart(product);
                          }
                        }}
                        disabled={isOutOfStock}
                        activeOpacity={isOutOfStock ? 1 : 0.7}
                      >
                        {selectedProducts.has(product.productName) && !isOutOfStock && (
                          <View style={styles.checkIconContainer}>
                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                          </View>
                        )}
                        <View style={styles.menuItemContentWeb}>
                          <Text numberOfLines={2} style={styles.menuItemNameWeb}>{product.productName}</Text>
                          <Text style={styles.menuItemCategoryWeb}>{product.category?.categoryName || 'N/A'}</Text>
                          <Text style={styles.menuItemPriceWeb}>USD {(Number(product.priceUsd || 0)).toFixed(2)}</Text>
                          <Text style={styles.menuItemPriceCdfWeb}>
                            CDF {(Number(product.priceUsd || 0) * (exchangeRate || 0)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                          </Text>
                          <Text style={[styles.menuItemStockWeb, isOutOfStock && styles.menuItemStockEmpty]}>
                            Stock: {product.inStock || 0}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>
              </>
            )}
          </View>

          {/* Panneau gauche - Résumé de commande */}
          <View style={styles.orderPanelWeb}>
            <ScrollView style={styles.orderScrollView}>
              {/* Articles de commande */}
              <View style={styles.orderItemsContainer}>
                {orderItems.map((item, index) => (
                  <View key={index} style={styles.orderItem}>
                    <View style={styles.orderItemHeader}>
                      <View style={styles.orderItemInfo}>
                        <Text style={styles.orderItemName}>{item.name}</Text>
                        <Text style={styles.orderItemDetails}>
                          {item.quantity} x {currencyPerItem[index] ? 'USD' : 'CDF'} {item.price.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.orderItemActions}>
                        <View style={styles.quantityControls}>
                          <TouchableOpacity
                            onPress={() => decreaseQuantity(index)}
                            style={styles.quantityButton}
                          >
                            <Ionicons name="remove" size={16} color="#6B7280" />
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{item.quantity}</Text>
                          <TouchableOpacity
                            onPress={() => increaseQuantity(index)}
                            style={styles.quantityButton}
                          >
                            <Ionicons name="add" size={16} color="#6B7280" />
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.orderItemPrice}>
                          {currencyPerItem[index] ? 'USD' : 'CDF'} {item.total.toFixed(2)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => removeItemFromCart(index)}
                          style={styles.removeButton}
                        >
                          <Ionicons name="trash" size={25} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {/* Switch USD/CDF */}
                    <View style={styles.currencySwitchContainer}>
                      <Text style={styles.currencySwitchLabel}>Devise:</Text>
                      <View style={styles.currencySwitch}>
                        <TouchableOpacity
                          style={[
                            styles.currencySwitchButton,
                            !currencyPerItem[index] && styles.currencySwitchButtonActive
                          ]}
                          onPress={() => !currencyPerItem[index] || toggleCurrency(index)}
                        >
                          <Text style={[
                            styles.currencySwitchText,
                            !currencyPerItem[index] && styles.currencySwitchTextActive
                          ]}>
                            CDF
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.currencySwitchButton,
                            currencyPerItem[index] && styles.currencySwitchButtonActive
                          ]}
                          onPress={() => currencyPerItem[index] || toggleCurrency(index)}
                        >
                          <Text style={[
                            styles.currencySwitchText,
                            currencyPerItem[index] && styles.currencySwitchTextActive
                          ]}>
                            USD
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {item.note && (
                      <View style={styles.orderItemNote}>
                        <Text style={styles.orderItemNoteText}>{item.note}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Résumé financier */}
              <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total CDF:</Text>
                  <Text style={styles.summaryValue}>
                    CDF {totalCdf.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total USD:</Text>
                  <Text style={styles.summaryValue}>
                    USD {totalUsdDisplay.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Sous-total:</Text>
                  <Text style={styles.summaryValue}>
                    CDF {subtotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  </Text>
                </View>
                {(displayReductionCdf > 0 || displayReductionUsd > 0) && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Réduction:</Text>
                    <Text style={styles.summaryValue}>
                      {useUsdAmounts
                        ? `USD ${displayReductionUsd.toFixed(2)}`
                        : `CDF ${displayReductionCdf.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`}
                    </Text>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.finalTotalRow]}>
                  <Text style={styles.finalTotalLabel}>TOTAL FINAL:</Text>
                  <Text style={styles.finalTotalValue}>
                    CDF {total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>TOTAL FINAL USD:</Text>
                  <Text style={styles.summaryValue}>
                    USD {totalFinalUsd.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Formulaire de commande */}
              <View style={styles.actionsContainer}>
                <View style={styles.formContainer}>
                  <View style={styles.amountToggleRow}>
                    <Text style={styles.formLabel}>Montant en</Text>
                    <View style={styles.amountToggleSwitch}>
                      <Text
                        style={[
                          styles.amountToggleOption,
                          !useUsdAmounts && styles.amountToggleOptionActive
                        ]}
                      >
                        CDF
                      </Text>
                      <Switch
                        value={useUsdAmounts}
                        onValueChange={setUseUsdAmounts}
                        trackColor={{ false: '#E5E7EB', true: '#34D399' }}
                        thumbColor={useUsdAmounts ? '#059669' : '#FFFFFF'}
                      />
                      <Text
                        style={[
                          styles.amountToggleOption,
                          useUsdAmounts && styles.amountToggleOptionActive
                        ]}
                      >
                        USD
                      </Text>
                    </View>
                  </View>

                        {/* Réduction */}
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Réduction</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={discount}
                      onChangeText={setDiscount}
                    />
                  </View>

                  {/* Montant CDF et USD */}
                  <View style={styles.amountRowWeb}>
                    <View style={styles.amountFieldWeb}>
                      <Text style={styles.formLabel}>Montant CDF</Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          useUsdAmounts && styles.disabledInput
                        ]}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={amountCdf}
                        onChangeText={handleAmountCdfChange}
                        editable={!useUsdAmounts}
                        selectTextOnFocus={!useUsdAmounts}
                      />
                    </View>
                    <View style={styles.amountFieldWeb}>
                      <Text style={styles.formLabel}>Montant USD</Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          !useUsdAmounts && styles.disabledInput
                        ]}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={amountUsd}
                        onChangeText={handleAmountUsdChange}
                        editable={useUsdAmounts}
                        selectTextOnFocus={useUsdAmounts}
                      />
                    </View>
                  </View>

                  {/* Nom du client */}
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Nom du client</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Entrez le nom du client"
                      placeholderTextColor="#9CA3AF"
                      value={customerName}
                      onChangeText={setCustomerName}
                    />
                  </View>

                  {/* Contact */}
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Contact</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Téléphone ou email"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                      value={customerContact}
                      onChangeText={setCustomerContact}
                    />
                  </View>

                  {/* Notice */}
                  <View style={styles.formField}>
                    <Text style={styles.formLabel}>Notice</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextArea]}
                      placeholder="Instructions spéciales..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={3}
                      value={commandNotice}
                      onChangeText={setCommandNotice}
                    />
                  </View>


                  {/* Mode de paiement */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Mode de paiement</Text>
                  <View style={styles.paymentMethodContainerMobile}>
                    {['Cash', 'EquityBCDC', 'Ecobank', 'Orange-Money', 'M-Pesa', 'Airtel-Money'].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.paymentMethodButtonMobile,
                          paymentMethod === method && styles.paymentMethodButtonActiveMobile
                        ]}
                        onPress={() => setPaymentMethod(method)}
                      >
                        {paymentMethod === method && (
                          <View style={styles.paymentCheckIconContainer}>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          </View>
                        )}
                        <Text style={[
                          styles.paymentMethodTextMobile,
                          paymentMethod === method && styles.paymentMethodTextActiveMobile
                        ]}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                </View>


                {/* Bouton Choisir une table 
                <TouchableOpacity
                  style={styles.chooseTableButton}
                  onPress={() => setShowTableModal(true)}
                >
                  <Ionicons name="restaurant-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.chooseTableButtonText}>
                    {selectedTable ? (selectedTable.nomination || `Table ${selectedTable.id}`) : 'Choisir une table'}
                  </Text>
                </TouchableOpacity>*/}

                {/* Bouton Commande */}
                <TouchableOpacity 
                  style={[
                    styles.orderButton,
                    (isCreatingFacture || !isTableSelected) && styles.orderButtonDisabled
                  ]} 
                  onPress={handleConfirmPaymentWeb}
                  disabled={isCreatingFacture || !isTableSelected}
                >
                  {isCreatingFacture ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="calculator" size={24} color="white" />
                  )}
                  <Text style={styles.orderButtonText}>
                    {isCreatingFacture 
                      ? 'Enregistrement...' 
                      : 'Enregistrer la commande'
                    }
                  </Text>
                </TouchableOpacity>
                {!isTableSelected && (
                  <Text style={styles.noTableText}>Aucun poste trouvé</Text>
                )}
              </View>
            </ScrollView>
          </View>

        </View>


        {/* Modal de sélection de table */}
        {showTableModal && (
          <View style={styles.tableModalOverlay}>
            <TouchableOpacity
              style={styles.tableModalBackdrop}
              activeOpacity={1}
              onPress={() => setShowTableModal(false)}
            >
              <TouchableOpacity
                style={styles.tableModalContent}
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.tableModalHeader}>
                  <Text style={styles.tableModalTitle}>Sélectionner une table</Text>
                  <TouchableOpacity onPress={() => setShowTableModal(false)} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.tableGridContainer}>
                  {tables.sort((a: any, b: any) => {
                    // Trier par nomination si disponible, sinon par id
                    const aValue = a.nomination || a.id;
                    const bValue = b.nomination || b.id;
                    
                    // Extraire les nombres des nominations (ex: "Table 1" -> 1)
                    const aNum = parseInt(aValue.toString().replace(/\D/g, '')) || aValue;
                    const bNum = parseInt(bValue.toString().replace(/\D/g, '')) || bValue;
                    
                    return aNum - bNum;
                  }).map((table: any) => (
                    <TouchableOpacity
                      key={table.id}
                      style={styles.tableContainer}
                      onPress={() => {
                        handleTableSelection(table);
                        setShowTableModal(false);
                      }}
                    >
                      {/* Numéro de table au-dessus */}
                      <Text style={styles.tableNumberText}>
                        {table.id}
                      </Text>

                      {/* Image de la table */}
                      <View style={[
                        styles.tableImageContainer,
                        selectedTable?.id === table.id && styles.tableSelected
                      ]}>
                        <Image
                          source={require('../assets/images/TABLE.png')}
                          style={styles.tableImage}
                          resizeMode="contain"
                        />
                      </View>

                      {/* Statut de la table */}
                      {selectedTable?.id === table.id && (
                        <Text style={styles.tableStatusText}>
                          Occupée
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }


  // Version Mobile/Tablet
  return (
    <View style={styles.containerMobile}>
      {/* Header avec bouton retour */}
      <View style={styles.headerMobile}>
        <TouchableOpacity 
          style={styles.backToTableButtonMobile}
          onPress={() => setShowTableModal(true)}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          <Text style={styles.backToTableButtonTextMobile}>Changer de poste</Text>
        </TouchableOpacity>
        <View style={styles.headerMobileInfo}>
          <Text style={styles.headerTitleMobile}>
            POS - {selectedTable ? (selectedTable.nomination || `Table ${selectedTable.id}`) : 'Table'} | Taux: {exchangeRate}
          </Text>
          <Text style={styles.headerSubtitleMobile}>
            {selectedTable ? (selectedTable.description || 'Poste disponible') : ''}
          </Text>
        </View>
      </View>
      
      {/* Header de recherche */}
      <View style={styles.searchHeaderMobile}>
        <View style={styles.searchBarMobile}>
          <Ionicons name="search" size={16} color="#6B7280" />
          <TextInput
            placeholder="Rechercher un produit"
            style={styles.searchInputMobile}
            placeholderTextColor="#9CA3AF"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
      </View>

      <View style={styles.mainContentMobile}>
        {/* Panneau gauche - Résumé de commande */}
        {isLargeScreen ? (<View style={styles.orderPanelMobile}>
          <ScrollView style={styles.orderScrollViewMobile}>
            {/* Articles de commande */}
            <View style={styles.orderItemsContainer}>
              {orderItems.map((item, index) => (
                <View key={index} style={styles.orderItem}>
                  <View style={styles.orderItemHeader}>
                    <View style={styles.orderItemInfo}>
                      <Text style={styles.orderItemNameMobile}>{item.name}</Text>
                      <Text style={styles.orderItemDetailsMobile}>
                        {item.quantity} x {currencyPerItem[index] ? 'USD' : 'CDF'} {item.price.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.orderItemActions}>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          onPress={() => decreaseQuantity(index)}
                          style={styles.quantityButton}
                        >
                          <Ionicons name="remove" size={14} color="#6B7280" />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <TouchableOpacity
                          onPress={() => increaseQuantity(index)}
                          style={styles.quantityButton}
                        >
                          <Ionicons name="add" size={14} color="#6B7280" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.orderItemPriceMobile}>
                        {currencyPerItem[index] ? 'USD' : 'CDF'} {item.total.toFixed(2)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeItemFromCart(index)}
                        style={styles.removeButton}
                      >
                        <Ionicons name="trash" size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* Switch USD/CDF */}
                  <View style={styles.currencySwitchContainer}>
                    <Text style={styles.currencySwitchLabel}>Devise:</Text>
                    <View style={styles.currencySwitch}>
                      <TouchableOpacity
                        style={[
                          styles.currencySwitchButton,
                          !currencyPerItem[index] && styles.currencySwitchButtonActive
                        ]}
                        onPress={() => !currencyPerItem[index] || toggleCurrency(index)}
                      >
                        <Text style={[
                          styles.currencySwitchText,
                          !currencyPerItem[index] && styles.currencySwitchTextActive
                        ]}>
                          CDF
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.currencySwitchButton,
                          currencyPerItem[index] && styles.currencySwitchButtonActive
                        ]}
                        onPress={() => currencyPerItem[index] || toggleCurrency(index)}
                      >
                        <Text style={[
                          styles.currencySwitchText,
                          currencyPerItem[index] && styles.currencySwitchTextActive
                        ]}>
                          USD
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {item.note && (
                    <View style={styles.orderItemNote}>
                      <Text style={styles.orderItemNoteTextMobile}>{item.note}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Résumé financier */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelMobile}>Total CDF:</Text>
                <Text style={styles.summaryValueMobile}>CDF {totalCdf.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelMobile}>Total USD:</Text>
                <Text style={styles.summaryValueMobile}>USD {totalUsdDisplay.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelMobile}>Total USD en CDF:</Text>
                <Text style={styles.summaryValueMobile}>CDF {totalUsdInCdfDisplay.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelMobile}>Sous-total:</Text>
                <Text style={styles.summaryValueMobile}>CDF {subtotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelMobile}>Taxes (13%):</Text>
                <Text style={styles.summaryValueMobile}>CDF {tax.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelMobile}>Réduction:</Text>
                <Text style={styles.summaryValueMobile}>
                  {useUsdAmounts
                    ? `USD ${displayReductionUsd.toFixed(2)}`
                    : `CDF ${displayReductionCdf.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.finalTotalRow]}>
                <Text style={styles.finalTotalLabelMobile}>TOTAL FINAL:</Text>
                <Text style={styles.finalTotalValueMobile}>CDF {total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelMobile}>TOTAL FINAL USD:</Text>
                <Text style={styles.summaryValueMobile}>USD {totalFinalUsd.toFixed(2)}</Text>
              </View>
            </View>

            {/* Formulaire de commande */}
            <View style={styles.actionsContainer}>
              <View style={styles.formContainer}>
                  <View style={styles.amountToggleRow}>
                    <Text style={styles.formLabel}>Montant en</Text>
                    <View style={styles.amountToggleSwitch}>
                      <Text
                        style={[
                          styles.amountToggleOption,
                          !useUsdAmounts && styles.amountToggleOptionActive
                        ]}
                      >
                        CDF
                      </Text>
                      <Switch
                        value={useUsdAmounts}
                        onValueChange={setUseUsdAmounts}
                        trackColor={{ false: '#E5E7EB', true: '#34D399' }}
                        thumbColor={useUsdAmounts ? '#059669' : '#FFFFFF'}
                      />
                      <Text
                        style={[
                          styles.amountToggleOption,
                          useUsdAmounts && styles.amountToggleOptionActive
                        ]}
                      >
                        USD
                      </Text>
                    </View>
                  </View>

                  <View style={styles.amountRowMobile}>
                    <View style={styles.amountFieldMobile}>
                      <Text style={styles.formLabel}>Montant CDF</Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          useUsdAmounts && styles.disabledInput
                        ]}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={amountCdf}
                        onChangeText={handleAmountCdfChange}
                        editable={!useUsdAmounts}
                        selectTextOnFocus={!useUsdAmounts}
                      />
                    </View>
                    <View style={styles.amountFieldMobile}>
                      <Text style={styles.formLabel}>Montant USD</Text>
                      <TextInput
                        style={[
                          styles.formInput,
                          !useUsdAmounts && styles.disabledInput
                        ]}
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={amountUsd}
                        onChangeText={handleAmountUsdChange}
                        editable={useUsdAmounts}
                        selectTextOnFocus={useUsdAmounts}
                      />
                    </View>
                  </View>

                {/* Nom du client */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Nom du client</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Entrez le nom du client"
                    placeholderTextColor="#9CA3AF"
                    value={customerName}
                    onChangeText={setCustomerName}
                  />
                </View>

                {/* Contact */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Contact</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Téléphone ou email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    value={customerContact}
                    onChangeText={setCustomerContact}
                  />
                </View>

                {/* Notice */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Notice</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    placeholder="Instructions spéciales..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    value={commandNotice}
                    onChangeText={setCommandNotice}
                  />
                </View>

                {/* Réduction */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Réduction</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={discount}
                    onChangeText={setDiscount}
                  />
                </View>



                {/* Mode de paiement */}
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Mode de paiement</Text>
                  <View style={styles.paymentMethodContainerMobile}>
                    {['Cash', 'Carte bancaire', 'Chèque', 'Virement'].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.paymentMethodButtonMobile,
                          paymentMethod === method && styles.paymentMethodButtonActiveMobile
                        ]}
                        onPress={() => setPaymentMethod(method)}
                      >
                        {paymentMethod === method && (
                          <View style={styles.paymentCheckIconContainer}>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          </View>
                        )}
                        <Text style={[
                          styles.paymentMethodTextMobile,
                          paymentMethod === method && styles.paymentMethodTextActiveMobile
                        ]}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Boutons Récompense et Devis */}
              <View style={styles.rewardButtonsContainer}>
                <TouchableOpacity style={styles.rewardButtonMobile}>
                  <Text style={styles.rewardButtonTextMobile}>Récompense</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rewardButtonMobile}>
                  <Text style={styles.rewardButtonTextMobile}>Devis/Commande</Text>
                </TouchableOpacity>
              </View>

              {/* Bouton Choisir une table */}
              <TouchableOpacity
                style={styles.chooseTableButtonMobile}
                onPress={() => setShowTableModal(true)}
              >
                <Ionicons name="restaurant-outline" size={18} color="#FFFFFF" />
                <Text style={styles.chooseTableButtonTextMobile}>
                  {selectedTable ? (selectedTable.nomination || `Table ${selectedTable.id}`) : 'Choisir une table'}
                </Text>
              </TouchableOpacity>


              {/* Bouton Commande */}
              <TouchableOpacity
                style={[
                  styles.orderButtonMobile,
                  (isCreatingFacture || !isTableSelected) && styles.orderButtonMobileDisabled
                ]}
                onPress={handleConfirmPaymentWeb}
                disabled={isCreatingFacture || !isTableSelected}
              >
                <Ionicons name="restaurant" size={20} color="white" />
                <Text style={styles.orderButtonTextMobile}>
                  Commande - Boissons 1 | Nourriture 3
                </Text>
              </TouchableOpacity>
              {!isTableSelected && (
                <Text style={styles.noTableText}>Aucun poste trouvé</Text>
              )}
            </View>
          </ScrollView>
        </View>):(<></>)}

        {/* Panneau droit - Menu des produits */}
        <View style={styles.menuPanelMobile}>
          {/* Sélecteur de catégories - Mobile */}
          <View style={styles.categorySelectorMobile}>
            <Text style={styles.categoryLabelMobile}>Catégorie:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.categoryButtonsMobile}>
                {apiCategories.map((category) => (
                <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryButtonMobile,
                      selectedCategory === category && styles.categoryButtonActiveMobile
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[
                      styles.categoryButtonTextMobile,
                      selectedCategory === category && styles.categoryButtonTextActiveMobile
                    ]}>
                      {category}
                    </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
      </View>

                  <ScrollView
                    refreshControl={
                      <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        colors={['#00436C']}
                        tintColor="#00436C"
                      />
                    }
                  >
                    {displayedMenuItems.length === 0 && isRefreshing ? (
                      <View style={styles.loadingCardMobile}>
                        <ActivityIndicator size="large" color="#00436C" />
                        <Text style={styles.loadingTextMobile}>Chargement des produits...</Text>
                        <Text style={styles.loadingSecondsMobile}>{loadingSeconds}s / 3s</Text>
                      </View>
                    ) : (
                      <View style={styles.menuGrid}>
                        {filteredMenuItems.map((product: any, index: number) => {
                          const isOutOfStock = (product.inStock || 0) === 0;
                          return (
                            <TouchableOpacity
                              key={product.id || index}
                              style={[
                                styles.menuItemMobile,
                                selectedProducts.has(product.productName) && styles.menuItemSelected,
                                isOutOfStock && styles.menuItemDisabled
                              ]}
                              onPress={() => {
                                if (!isOutOfStock) {
                                  addProductToCart(product);
                                }
                              }}
                              disabled={isOutOfStock}
                              activeOpacity={isOutOfStock ? 1 : 0.7}
                            >
                              {selectedProducts.has(product.productName) && !isOutOfStock && (
                                <View style={styles.checkIconContainer}>
                                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                </View>
                              )}
                              <View style={styles.menuItemContentMobile}>
                                <Text numberOfLines={2} style={styles.menuItemNameMobile}>{product.productName}</Text>
                                <Text style={styles.menuItemCategoryMobile}>{product.category?.categoryName || 'N/A'}</Text>
                                <Text style={styles.menuItemPriceMobile}>USD {(Number(product.priceUsd || 0)).toFixed(2)}</Text>
                                <Text style={styles.menuItemPriceCdfMobile}>
                                  CDF {(Number(product.priceUsd || 0) * (exchangeRate || 0)).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                </Text>
                                <Text style={[
                                  styles.menuItemStockMobile,
                                  isOutOfStock && styles.menuItemStockEmptyMobile
                                ]}>
                                  Stock: {product.inStock || 0}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                            </View>
                    )}
                  </ScrollView>
                  </View>
        </View>


      {/* Bouton flottant panier avec badge en bas à droite */}
      <View
        style={{
          position: 'absolute',
          bottom: 32,
          right: 24,
          zIndex: 2000,
        }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={{
            backgroundColor: '#714B66',
            borderRadius: 32,
            width: 56,
            height: 56,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 6,
          }}
          activeOpacity={0.85}
          onPress={() => setShowCartModal(true)}
        >
          <Ionicons name="cart" size={28} color="#fff" />
          {orderItems.length > 0 && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: '#EF4444',
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 5,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                {orderItems.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal Panier*/}
      {showCartModal && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: 10,
            paddingBottom: 10,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 3000,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setShowCartModal(false)}
          />
          <ScrollView
            style={{
              width: '90%',
              maxWidth: 400,
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 8,
            }}
            contentContainerStyle={{
              paddingBottom: 30,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#222' }}>
                Panier
              </Text>
              <TouchableOpacity onPress={() => setShowCartModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Contenu du panier */}
            <>
              <ScrollView style={{ marginBottom: 12 }}>
                  {orderItems.length === 0 ? (
                    <Text style={{ color: '#888', textAlign: 'center', marginVertical: 24 }}>Votre panier est vide.</Text>
                  ) : (
                    orderItems.map((item, idx) => (
                      <View key={idx} style={{ 
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 12,
                        backgroundColor: '#F9FAFB'
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600', color: '#222', fontSize: 15 }}>{item.name}</Text>
                            <Text style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
                              {item.quantity} x {currencyPerItem[idx] ? 'USD' : 'CDF'} {item.price.toFixed(2)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontWeight: '600', color: '#222', fontSize: 15 }}>
                              {currencyPerItem[idx] ? 'USD' : 'CDF'} {item.total.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                        
                        {/* Contrôles de quantité */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 6, padding: 4 }}>
                            <TouchableOpacity
                              onPress={() => decreaseQuantity(idx)}
                              style={{ padding: 6, backgroundColor: '#F3F4F6', borderRadius: 4 }}
                            >
                              <Ionicons name="remove" size={16} color="#6B7280" />
                            </TouchableOpacity>
                            <Text style={{ paddingHorizontal: 12, fontWeight: '600', color: '#222' }}>{item.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => increaseQuantity(idx)}
                              style={{ padding: 6, backgroundColor: '#F3F4F6', borderRadius: 4 }}
                            >
                              <Ionicons name="add" size={16} color="#6B7280" />
                            </TouchableOpacity>
                          </View>
                          
                          <TouchableOpacity
                            onPress={() => removeItemFromCart(idx)}
                            style={{ padding: 6 }}
                          >
                            <Ionicons name="trash" size={20} color="#DC2626" />
                          </TouchableOpacity>
                        </View>

                        {/* Switch USD/CDF */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color: '#6B7280' }}>Devise:</Text>
                          <View style={{ flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 6, padding: 2 }}>
                            <TouchableOpacity
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 12,
                                borderRadius: 4,
                                backgroundColor: !currencyPerItem[idx] ? '#7C3AED' : 'transparent'
                              }}
                              onPress={() => !currencyPerItem[idx] || toggleCurrency(idx)}
                            >
                              <Text style={{
                                fontSize: 13,
                                fontWeight: '500',
                                color: !currencyPerItem[idx] ? '#FFFFFF' : '#6B7280'
                              }}>
                                CDF
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                paddingVertical: 4,
                                paddingHorizontal: 12,
                                borderRadius: 4,
                                backgroundColor: currencyPerItem[idx] ? '#7C3AED' : 'transparent'
                              }}
                              onPress={() => currencyPerItem[idx] || toggleCurrency(idx)}
                            >
                              <Text style={{
                                fontSize: 13,
                                fontWeight: '500',
                                color: currencyPerItem[idx] ? '#FFFFFF' : '#6B7280'
                              }}>
                                USD
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {item.note && (
                          <View style={{ marginTop: 8, padding: 8, backgroundColor: '#FFFFFF', borderRadius: 4 }}>
                            <Text style={{ color: '#9CA3AF', fontSize: 12, fontStyle: 'italic' }}>{item.note}</Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </ScrollView>
                <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 12, marginBottom: 12, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>Total CDF:</Text>
                    <Text style={{ color: '#374151', fontWeight: '600', fontSize: 14 }}>
                      CDF {totalCdf.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>Total USD:</Text>
                    <Text style={{ color: '#374151', fontWeight: '600', fontSize: 14 }}>USD {totalUsdDisplay.toFixed(2)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>Sous-total:</Text>
                    <Text style={{ color: '#374151', fontWeight: '600', fontSize: 14 }}>
                      CDF {subtotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    </Text>
                  </View>
                  {(displayReductionCdf > 0 || displayReductionUsd > 0) && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: '#6B7280', fontSize: 14 }}>Réduction:</Text>
                      <Text style={{ color: '#374151', fontWeight: '600', fontSize: 14 }}>
                        {useUsdAmounts
                          ? `USD ${displayReductionUsd.toFixed(2)}`
                          : `CDF ${displayReductionCdf.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`}
                      </Text>
                    </View>
                  )}
                  <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontWeight: 'bold', color: '#111827', fontSize: 16 }}>TOTAL FINAL:</Text>
                    <Text style={{ fontWeight: 'bold', color: '#7C3AED', fontSize: 16 }}>
                      CDF {total.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>TOTAL FINAL USD:</Text>
                    <Text style={{ color: '#374151', fontWeight: '600', fontSize: 14 }}>USD {totalFinalUsd.toFixed(2)}</Text>
                  </View>
                </View>
                {/* Montants */}
                <View style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#374151', fontWeight: '500' }}>Montant en</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: useUsdAmounts ? '#6B7280' : '#1F2937', fontWeight: !useUsdAmounts ? '600' : '500' }}>CDF</Text>
                    <Switch
                      value={useUsdAmounts}
                      onValueChange={setUseUsdAmounts}
                      trackColor={{ false: '#E5E7EB', true: '#34D399' }}
                      thumbColor={useUsdAmounts ? '#059669' : '#FFFFFF'}
                    />
                    <Text style={{ color: useUsdAmounts ? '#1F2937' : '#6B7280', fontWeight: useUsdAmounts ? '600' : '500' }}>USD</Text>
                  </View>
                </View>
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#374151', marginBottom: 4, fontWeight: '500' }}>Montant CDF</Text>
                  <TextInput
                    value={amountCdf}
                    onChangeText={setAmountCdf}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    editable={!useUsdAmounts}
                    selectTextOnFocus={!useUsdAmounts}
                    style={{
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 15,
                      color: useUsdAmounts ? '#9CA3AF' : '#222',
                      backgroundColor: useUsdAmounts ? '#F3F4F6' : '#FFFFFF',
                    }}
                  />
                </View>
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#374151', marginBottom: 4, fontWeight: '500' }}>Montant USD</Text>
                  <TextInput
                    value={amountUsd}
                    onChangeText={setAmountUsd}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    editable={useUsdAmounts}
                    selectTextOnFocus={useUsdAmounts}
                    style={{
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 15,
                      color: useUsdAmounts ? '#222' : '#9CA3AF',
                      backgroundColor: useUsdAmounts ? '#FFFFFF' : '#F3F4F6',
                    }}
                  />
                </View>

                {/* Champ nom du client */}
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#374151', marginBottom: 4, fontWeight: '500' }}>Nom du client</Text>
                  <TextInput
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholder="Entrez le nom du client"
                    placeholderTextColor="#9CA3AF"
                    style={{
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 15,
                      color: '#222',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </View>

                {/* Champ contact */}
                <View style={{ marginBottom: 10 }}>
                  <Text style={{ color: '#374151', marginBottom: 4, fontWeight: '500' }}>Contact</Text>
                  <TextInput
                    value={customerContact}
                    onChangeText={setCustomerContact}
                    placeholder="Téléphone ou email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    style={{
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 15,
                      color: '#222',
                      backgroundColor: '#FFFFFF',
                    }}
                  />
                </View>

                {/* Notice de commande */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ color: '#374151', marginBottom: 4, fontWeight: '500' }}>Notice</Text>
                  <TextInput
                    value={commandNotice}
                    onChangeText={setCommandNotice}
                    placeholder="Instructions spéciales..."
                    placeholderTextColor="#9CA3AF"
                    style={{
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                      borderRadius: 6,
                      padding: 10,
                      fontSize: 15,
                      color: '#222',
                      backgroundColor: '#FFFFFF',
                      textAlignVertical: 'top',
                      minHeight: 80,
                    }}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Dette */}
                <View style={{ marginBottom: 12, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View>
                    <Text style={{ color: '#374151', fontWeight: '600', fontSize: 14 }}>Dette ?</Text>
                    <Text style={{ color: '#6B7280', fontSize: 12 }}>Activer si la facture est à crédit</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontWeight: '600', color: isDebt ? '#047857' : '#6B7280' }}>{isDebt ? 'Oui' : 'Non'}</Text>
                    <Switch
                      value={isDebt}
                      onValueChange={setIsDebt}
                      trackColor={{ false: '#E5E7EB', true: '#34D399' }}
                      thumbColor={isDebt ? '#059669' : '#FFFFFF'}
                    />
                  </View>
                </View>

                {/* Mode de paiement */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: '#374151', marginBottom: 6, fontWeight: '500' }}>Mode de paiement</Text>
                  <View style={styles.paymentMethodContainerMobile}>
                    {['Cash', 'QquityBCDC', '(Autre)Carte bancaire', 'Mobile Money'].map((method) => (
                      <TouchableOpacity
                        key={method}
                        style={[
                          styles.paymentMethodButtonMobile,
                          paymentMethod === method && styles.paymentMethodButtonActiveMobile
                        ]}
                        onPress={() => setPaymentMethod(method)}
                      >
                        {paymentMethod === method && (
                          <View style={styles.paymentCheckIconContainer}>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          </View>
                        )}
                        <Text style={[
                          styles.paymentMethodTextMobile,
                          paymentMethod === method && styles.paymentMethodTextActiveMobile
                        ]}>
                          {method}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <TouchableOpacity
                  style={{
                    backgroundColor: isCreatingFacture || !isTableSelected ? '#9CA3AF' : '#00436C',
                    borderRadius: 8,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 8,
                    gap: 8,
                    opacity: isCreatingFacture || !isTableSelected ? 0.7 : 1,
                  }}
                  onPress={handleConfirmPaymentWeb}
                  disabled={isCreatingFacture || !isTableSelected}
                >
                  {isCreatingFacture ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Ionicons name="calculator" size={20} color="white" />
                  )}
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                    {isCreatingFacture ? 'Enregistrement...' : 'Enregistrer la commande'}
                  </Text>
                </TouchableOpacity>
                {!isTableSelected && (
                  <Text style={styles.noTableText}>Aucun poste trouvé</Text>
                )}
            </>

          </ScrollView>
        </View>
      )}

      {/* Modal de sélection de table */}
      {showTableModal && (
        <View style={styles.tableModalOverlay}>
          <TouchableOpacity
            style={styles.tableModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowTableModal(false)}
          >
            <TouchableOpacity
              style={styles.tableModalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.tableModalHeader}>
                <Text style={styles.tableModalTitle}>Sélectionner une table</Text>
                <TouchableOpacity onPress={() => setShowTableModal(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.tableGridContainer}>
                {tables.sort((a: any, b: any) => {
                  // Trier par nomination si disponible, sinon par id
                  const aValue = a.nomination || a.id;
                  const bValue = b.nomination || b.id;
                  
                  // Extraire les nombres des nominations (ex: "Table 1" -> 1)
                  const aNum = parseInt(aValue.toString().replace(/\D/g, '')) || aValue;
                  const bNum = parseInt(bValue.toString().replace(/\D/g, '')) || bValue;
                  
                  return aNum - bNum;
                }).map((table: any) => (
                  <TouchableOpacity
                    key={table.id}
                    style={styles.tableContainer}
                    onPress={() => {
                      handleTableSelection(table);
                      setShowTableModal(false);
                    }}
                  >
                    {/* Numéro de table au-dessus */}
                    <Text style={styles.tableNumberText}>
                      {table.id}
                    </Text>

                    {/* Image de la table */}
                    <View style={[
                      styles.tableImageContainer,
                      selectedTable?.id === table.id && styles.tableSelected
                    ]}>
                      <Image
                        source={require('../assets/images/TABLE.png')}
                        style={styles.tableImage}
                        resizeMode="contain"
                      />
                    </View>

                    {/* Statut de la table */}
                    {selectedTable?.id === table.id && (
                      <Text style={styles.tableStatusText}>
                        Occupée
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

      {/* Overlay de chargement global */}
      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingModalContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingModalText}>Création de la facture...</Text>
            <Text style={styles.loadingModalSubtext}>Veuillez patienter</Text>
          </View>
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
    position: 'relative',
  },
  
  // États de chargement et erreurs
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronIcon: {
    marginLeft: 8,
  },
  headerTitleWeb: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchBarContainerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBarWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
  },
  searchInputWeb: {
    marginLeft: 8,
    fontSize: 16,
    color: '#4B5563',
    flex: 1,
  },
  refreshButtonWeb: {
    backgroundColor: '#00436C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00436C',
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
  },

  // Container Mobile
  containerMobile: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleMobile: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  searchBarMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInputMobile: {
    marginLeft: 8,
    fontSize: 14,
    color: '#4B5563',
  },

  // Main Content Web
  mainContentWeb: {
    flexDirection: 'row',
    flex: 1,
  },
  orderPanelWeb: {
    width: '33.333%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    borderLeftWidth: 1,
    borderLeftColor: '#9CA3AF',
  },
  orderScrollView: {
    flex: 1,
  },

  // Main Content Mobile
  mainContentMobile: {
    flexDirection: 'column',
    flex: 1,
  },
  orderPanelMobile: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderLeftWidth: 1,
    borderLeftColor: '#9CA3AF',
    maxHeight: 320,
  },
  orderScrollViewMobile: {
    flex: 1,
  },

  // Order Items
  orderItemsContainer: {
    padding: 24,
  },
  orderItem: {
    marginBottom: 12,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#FEF2F2',
  },
  
  // Contrôles de quantité
  quantityControls: {
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
  
  // Sélection de produit
  menuItemSelected: {
    borderColor: '#10B981',
    borderWidth: 2,
  },
  
  // Icône de validation
  checkIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  
  // Icône de validation pour les modes de paiement
  paymentCheckIconContainer: {
    // Pas de position absolue, juste un conteneur pour l'icône
  },
  orderItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  orderItemNameMobile: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  orderItemDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  orderItemDetailsMobile: {
    fontSize: 12,
    color: '#6B7280',
  },
  orderItemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  orderItemPriceMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  orderItemNote: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
  },
  orderItemNoteText: {
    fontSize: 14,
    color: '#92400E',
  },
  orderItemNoteTextMobile: {
    fontSize: 12,
    color: '#92400E',
  },

  // Summary
  summaryContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#4B5563',
  },
  summaryLabelMobile: {
    fontSize: 14,
    color: '#4B5563',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  summaryValueMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },

  // Actions
  actionsContainer: {
    padding: 24,
  },
  formContainer: {
    marginBottom: 16,
  },
  amountToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  amountToggleSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountToggleOption: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  amountToggleOptionActive: {
    color: '#1F2937',
    fontWeight: '700',
  },
  amountRowWeb: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  amountFieldWeb: {
    flex: 1,
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  formTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  debtSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  debtSwitchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  actionButtonMobile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  actionButtonActive: {
    backgroundColor: '#EDE9FE',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  actionButtonTextMobile: {
    fontSize: 12,
    color: '#374151',
  },
  actionButtonTextActive: {
    color: '#7C3AED',
  },

  // Reward Buttons
  rewardButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  rewardButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  rewardButtonMobile: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  rewardButtonText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#374151',
  },
  rewardButtonTextMobile: {
    fontSize: 14,
    textAlign: 'center',
    color: '#374151',
  },
  amountRowMobile: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  amountFieldMobile: {
    flex: 1,
  },

  // Payment
  paymentContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  paymentButton: {
    flex: 1,
    paddingVertical: 20,
    backgroundColor: '#282828',
    borderRadius: 4,
  },
  paymentButtonMobile: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#282828',
    borderRadius: 4,
  },
  paymentButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  paymentButtonTextMobile: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },

  // Keypad
  keypadContainer: {
    flex: 1,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  keypadButton: {
    width: 60,
    height: 60,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadButtonMobile: {
    width: 32,
    height: 32,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadButtonText: {
    fontSize: 16,
    color: '#374151',
  },
  keypadButtonTextMobile: {
    fontSize: 14,
    color: '#374151',
  },

  // Order Button
  orderButton: {
    paddingVertical: 20,
    backgroundColor: '#00436C',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderButtonDisabled: {
    backgroundColor: '#6B7280', // Gris pour indiquer l'état désactivé
    opacity: 0.7,
  },
  
  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingModalContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  loadingModalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingModalSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  orderButtonMobile: {
    paddingVertical: 16,
    backgroundColor: '#7C3AED',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderButtonMobileDisabled: {
    backgroundColor: '#6B7280',
    opacity: 0.7,
  },
  orderButtonText: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 18,
    fontWeight: '600',
  },
  orderButtonTextMobile: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  noTableText: {
    marginTop: 8,
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Menu Panel Web
  menuPanelWeb: {
    flex: 1,
    padding: 24,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  menuItemWeb: {
    width: '22%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
    padding: 16,
  },
  menuItemDisabled: {
    borderColor: '#EF4444',
    borderLeftColor: '#EF4444',
    opacity: 0.6,
  },
  menuItemImageWeb: {
    width: '100%',
    height: 96,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  productImageWeb: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  menuItemContentWeb: {
    flex: 1,
    justifyContent: 'space-between',
  },
  menuItemNameWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'left',
  },
  menuItemCategoryWeb: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'left',
  },
  menuItemPriceWeb: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00436C',
    textAlign: 'left',
  },
  menuItemPriceCdfWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    textAlign: 'left',
    marginTop: 2,
  },
  menuItemStockWeb: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'left',
    marginTop: 2,
  },
  menuItemStockEmpty: {
    color: '#EF4444',
    fontWeight: '600',
  },

  // Menu Panel Mobile
  menuPanelMobile: {
    flex: 1,
    padding: 16,
  },
  menuItemMobile: {
    flex: 1,
    minWidth: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
    padding: 12,
    marginHorizontal: 4,
  },
  menuItemImageMobile: {
    width: '100%',
    height: 120,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  productImageMobile: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  menuItemContentMobile: {
    flex: 1,
    justifyContent: 'space-between',
  },
  menuItemNameMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'left',
  },
  menuItemCategoryMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'left',
  },
  menuItemPriceMobile: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00436C',
    textAlign: 'left',
  },
  menuItemPriceCdfMobile: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    textAlign: 'left',
    marginTop: 2,
  },
  menuItemStockMobile: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'left',
    marginTop: 2,
  },
  menuItemStockEmptyMobile: {
    color: '#EF4444',
    fontWeight: '600',
  },

  // Menu Item Info Icon
  menuItemInfoIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },

  // Styles pour la modal de produit
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
    maxWidth: 400,
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
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  modalHeaderImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
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
  modalImageContainer: {
    height: 200,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalPriceContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  modalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  quantityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  noteContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  noteLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#F9FAFB',
    textAlignVertical: 'top',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
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
  addToCartButton: {
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
  addToCartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Bouton Choisir une table
  chooseTableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 4,
    marginBottom: 16,
    gap: 8,
  },
  chooseTableButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chooseTableButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    borderRadius: 4,
    marginBottom: 12,
    gap: 6,
  },
  chooseTableButtonTextMobile: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal de sélection de table
  tableModalOverlay: {
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
  tableModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tableModalContent: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  tableModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  tableGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    padding: 12,
    gap: 12,
  },
  tableItem: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tableSquare: {
    borderRadius: 8,
  },
  tableCircle: {
    borderRadius: 40,
  },
  tableDiamond: {
    borderRadius: 8,
    transform: [{ rotate: '45deg' }],
  },
  tableItemText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Couleurs des tables
  tableWhite: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  tableYellow: {
    backgroundColor: '#FCD34D',
    borderColor: '#FBBF24',
  },
  tableBlue: {
    backgroundColor: '#60A5FA',
    borderColor: '#3B82F6',
  },
  tableGreen: {
    backgroundColor: '#4ADE80',
    borderColor: '#22C55E',
  },
  tableDarkGray: {
    backgroundColor: '#6B7280',
    borderColor: '#4B5563',
  },
  tableSelected: {
    borderWidth: 3,
    borderColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },

  // Nouveaux styles pour les tables avec images
  tableContainer: {
    alignItems: 'center',
    marginBottom: 12,
    padding: 6,
    width: '30%',
    minWidth: 80,
  },
  tableNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  tableImageContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  tableImage: {
    width: 40,
    height: 40,
  },
  tableStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 4,
    textAlign: 'center',
  },

  // Styles pour les modes de paiement
  paymentMethodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 4,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodButtonActive: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  paymentMethodTextActive: {
    color: '#10B981',
    fontWeight: '600',
  },

  paymentMethodContainerMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  paymentMethodButtonMobile: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 4,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paymentMethodButtonActiveMobile: {
    borderColor: '#10B981',
    backgroundColor: '#FFFFFF',
  },
  paymentMethodTextMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  paymentMethodTextActiveMobile: {
    color: '#10B981',
    fontWeight: '600',
  },
  
  // Sélecteur de catégories - Desktop
  categorySelectorWeb: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  categoryLabelWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  categoryButtonsWeb: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButtonWeb: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryButtonActiveWeb: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  categoryButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryButtonTextActiveWeb: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  
  // Sélecteur de catégories - Mobile
  categorySelectorMobile: {
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  categoryLabelMobile: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  categoryButtonsMobile: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryButtonMobile: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryButtonActiveMobile: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  categoryButtonTextMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryButtonTextActiveMobile: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Loading Card
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 40,
    margin: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadingSeconds: {
    fontSize: 16,
    color: '#00436C',
    fontWeight: '500',
  },
  loadingCardMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 30,
    margin: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  loadingTextMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  loadingSecondsMobile: {
    fontSize: 14,
    color: '#00436C',
    fontWeight: '500',
  },

  // Styles pour la vue de sélection de table
  tableSelectionContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tableSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableSelectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableSelectionTitle: {
    marginLeft: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  refreshButton: {
    marginLeft: 16,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  tableSelectionHeaderRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  tableSelectionSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'right',
  },
  tableSelectionScrollView: {
    flex: 1,
    padding: 12,
  },
  tableSelectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 8,
  },
  tableSelectionItem: {
    width: '48%',
    minWidth: 150,
    maxWidth: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
    flex: 1,
  },
  tableSelectionItemOccupied: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  tableSelectionItemSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tableSelectionImageContainer: {
    width: '100%',
    height: 60,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  tableSelectionImageOccupied: {
    backgroundColor: '#FEF3C7',
  },
  tableSelectionImage: {
    width: 40,
    height: 40,
  },
  tableSelectionOccupiedOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    padding: 4,
  },
  tableSelectionInfo: {
    alignItems: 'center',
  },
  tableSelectionNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 3,
  },
  tableSelectionDetails: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
    textAlign: 'center',
  },
  tableSelectionStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tableSelectionStatusAvailable: {
    backgroundColor: '#D1FAE5',
  },
  tableSelectionStatusOccupied: {
    backgroundColor: '#FEE2E2',
  },
  tableSelectionStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tableSelectionStatusTextAvailable: {
    color: '#065F46',
  },
  tableSelectionStatusTextOccupied: {
    color: '#991B1B',
  },
  tableSelectionCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  tableSelectionFooter: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tableSelectionInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tableSelectionInstructionsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Styles pour le header POS
  posHeaderWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backToTableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  backToTableButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  posHeaderInfo: {
    flex: 1,
    alignItems: 'center',
  },
  posHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  posHeaderSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },

  // Styles pour le header mobile
  backToTableButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  backToTableButtonTextMobile: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  headerMobileInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitleMobile: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  searchHeaderMobile: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  // Styles pour le switch de devise
  currencySwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  currencySwitchLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  currencySwitch: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 2,
  },
  currencySwitchButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  currencySwitchButtonActive: {
    backgroundColor: '#7C3AED',
  },
  currencySwitchText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  currencySwitchTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Styles pour le total final
  finalTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 8,
  },
  finalTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  finalTotalLabelMobile: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  finalTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  finalTotalValueMobile: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
});

export default POSComponent;