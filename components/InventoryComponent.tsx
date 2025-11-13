import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createCategory, deleteCategory, getCategories, updateCategory } from '../api/categoryApi';
import { createProduct, getProductById, getProducts, updateProduct } from '../api/productApi';
import { getProductStockHistory, reapprovisionStock, sortieStock, transferStock } from '../api/stockApi';
import { getDepotCodes } from '../api/userApi';
import { useApi } from '../hooks/useApi';
import { useFetch } from '../hooks/useFetch';
import { getUserData } from '../utils/storage';

// Composant Inventaire
const InventoryComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768; // Tablette = 768px, donc > 768px = desktop/large screen
  
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'product-management'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [userDepotCode, setUserDepotCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const productFetchParams = useMemo(
    () => (userDepotCode ? { depotCode: userDepotCode } : null),
    [userDepotCode]
  );
  
  // Hooks pour les données API
  const { data: categoriesData, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useFetch(getCategories);
  const { data: productsData, loading: productsLoading, error: productsError, refetch: refetchProducts } = useFetch(getProducts, productFetchParams as any);
  useEffect(() => {
    const loadUserDepot = async () => {
      try {
        const user = await getUserData();
        if (user?.depotCode) {
          setUserDepotCode(user.depotCode);
        }
        const claims = Array.isArray(user?.claims) ? user.claims : [];
        setIsAdmin(claims.includes('Admin'));
      } catch (error) {
        console.error('Erreur lors du chargement du dépôt utilisateur:', error);
      }
    };

    loadUserDepot();
  }, []);
  const { execute: executeApi, loading: apiLoading, error: apiError } = useApi();
  
  // Types pour éviter les erreurs TypeScript
  const categories = categoriesData || [];
  const products = productsData || [];
  
  // État pour le formulaire de catégorie (conforme aux DTOs)
  const [newCategory, setNewCategory] = useState({
    categoryName: '', // Conforme à NewCategoryDto
    description: ''   // Conforme à NewCategoryDto
  });
  const [editingCategory, setEditingCategory] = useState<any>(null);
  
  // Fonctions pour la gestion des catégories
  const handleCreateCategory = async () => {
    if (!newCategory.categoryName.trim()) {
      Alert.alert('Erreur', 'Le nom de la catégorie est obligatoire');
      return;
    }

    const success = await executeApi(createCategory, {
      categoryName: newCategory.categoryName,
      description: newCategory.description
    });

    if (success) {
      Alert.alert('Succès', 'Catégorie créée avec succès');
      setNewCategory({ categoryName: '', description: '' });
      // Rafraîchir la liste des catégories
      refetchCategories();
    } else {
      Alert.alert('Erreur', apiError || 'Erreur lors de la création de la catégorie');
    }
  };

  const handleUpdateCategory = async () => {
    if (!newCategory.categoryName.trim() || !editingCategory) {
      Alert.alert('Erreur', 'Le nom de la catégorie est obligatoire');
      return;
    }

    const success = await executeApi(updateCategory, editingCategory.id, {
      categoryName: newCategory.categoryName,
      description: newCategory.description
    });

    if (success) {
      Alert.alert('Succès', 'Catégorie mise à jour avec succès');
      setEditingCategory(null);
      setNewCategory({ categoryName: '', description: '' });
      // Rafraîchir la liste des catégories
      refetchCategories();
    } else {
      Alert.alert('Erreur', apiError || 'Erreur lors de la mise à jour de la catégorie');
    }
  };

  const handleDeleteCategory = async (category: any) => {
    Alert.alert(
      'Confirmer la suppression',
      `Êtes-vous sûr de vouloir supprimer la catégorie "${category.categoryName}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const success = await executeApi(deleteCategory, category.id);
            if (success) {
              Alert.alert('Succès', 'Catégorie supprimée avec succès');
              // Rafraîchir la liste des catégories
              refetchCategories();
            } else {
              Alert.alert('Erreur', apiError || 'Erreur lors de la suppression de la catégorie');
            }
          }
        }
      ]
    );
  };

  const editCategory = (category: any) => {
    setEditingCategory(category);
    setNewCategory({
      categoryName: category.categoryName,
      description: category.description
    });
  };

  // Fonction pour la mise à jour des produits
  const handleUpdateProduct = async () => {
    // Validation des champs obligatoires
    if (!newProduct.productName.trim()) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Le nom du produit est obligatoire');
      } else {
        Alert.alert('Erreur', 'Le nom du produit est obligatoire');
      }
      return;
    }
    if (!newProduct.categoryId.trim()) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Veuillez sélectionner une catégorie');
      } else {
        Alert.alert('Erreur', 'Veuillez sélectionner une catégorie');
      }
      return;
    }
    if (!newProduct.priceUsd.trim()) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Le prix USD est obligatoire');
      } else {
        Alert.alert('Erreur', 'Le prix USD est obligatoire');
      }
      return;
    }
    if (!newProduct.priceCdf.trim()) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Le prix CDF est obligatoire');
      } else {
        Alert.alert('Erreur', 'Le prix CDF est obligatoire');
      }
      return;
    }

    // Préparer les données pour l'API
    const userData = await getUserData();
    const depotCode = userData?.depotCode;

    if (!depotCode) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Code dépôt introuvable pour l’utilisateur connecté');
      } else {
        Alert.alert('Erreur', 'Code dépôt introuvable pour l’utilisateur connecté');
      }
      return;
    }

    const productData = {
      categoryId: newProduct.categoryId,
      productName: newProduct.productName,
      description: newProduct.description,
      priceUsd: parseFloat(newProduct.priceUsd),
      priceCdf: parseFloat(newProduct.priceCdf),
      minimalStock: parseInt(newProduct.minimalStock) || 0,
      imageBase64: newProduct.imageBase64,
      depotCode
    };

    const success = await executeApi(updateProduct, editingProduct.id, productData);

    if (success) {
      // Alerte pour le web
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('✅ Succès ! Produit modifié avec succès');
      } else {
        Alert.alert('Succès', 'Produit modifié avec succès');
      }
      // Réinitialiser le formulaire et sortir du mode édition
      setEditingProduct(null);
      setNewProduct({
        productName: '',
        categoryId: '',
        description: '',
        priceUsd: '',
        priceCdf: '',
        minimalStock: '',
        imageBase64: 'UkVTVE9NQU5BR0VSQVBQ'
      });
      // Rafraîchir la liste des produits
      refetchProducts();
    } else {
      // Alerte pour le web
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : ' + (apiError || 'Erreur lors de la modification du produit'));
      } else {
        Alert.alert('Erreur', apiError || 'Erreur lors de la modification du produit');
      }
    }
  };

  // Fonctions pour la gestion des produits
  const handleCreateProduct = async () => {
    // Validation des champs obligatoires
    if (!newProduct.productName.trim()) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Le nom du produit est obligatoire');
      } else {
        Alert.alert('Erreur', 'Le nom du produit est obligatoire');
      }
      return;
    }
    if (!newProduct.categoryId.trim()) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Veuillez sélectionner une catégorie');
      } else {
        Alert.alert('Erreur', 'Veuillez sélectionner une catégorie');
      }
      return;
    }
    if (!newProduct.priceUsd.trim()) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Le prix USD est obligatoire');
      } else {
        Alert.alert('Erreur', 'Le prix USD est obligatoire');
      }
      return;
    }
    if (!newProduct.priceCdf.trim()) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Le prix CDF est obligatoire');
      } else {
        Alert.alert('Erreur', 'Le prix CDF est obligatoire');
      }
      return;
    }

    // Préparer les données pour l'API
    const userData = await getUserData();
    const depotCode = userData?.depotCode;

    if (!depotCode) {
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : Code dépôt introuvable pour l’utilisateur connecté');
      } else {
        Alert.alert('Erreur', 'Code dépôt introuvable pour l’utilisateur connecté');
      }
      return;
    }

    const productData = {
      categoryId: newProduct.categoryId,
      productName: newProduct.productName,
      description: newProduct.description,
      priceUsd: parseFloat(newProduct.priceUsd),
      priceCdf: parseFloat(newProduct.priceCdf),
      minimalStock: parseInt(newProduct.minimalStock) || 0,
      imageBase64: newProduct.imageBase64,
      depotCode
    };

    const success = await executeApi(createProduct, productData);

    if (success) {
      // Alerte pour le web
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('✅ Succès ! Produit créé avec succès');
      } else {
        Alert.alert('Succès', 'Produit créé avec succès');
      }
      // Réinitialiser le formulaire
      setNewProduct({
        productName: '',
        categoryId: '',
        description: '',
        priceUsd: '',
        priceCdf: '',
        minimalStock: '',
        imageBase64: 'UkVTVE9NQU5BR0VSQVBQ'
      });
      // Rafraîchir la liste des produits
      refetchProducts();
    } else {
      // Alerte pour le web
      const isWeb = typeof window !== 'undefined' && typeof window.alert === 'function';
      if (isWeb) {
        window.alert('❌ Erreur : ' + (apiError || 'Erreur lors de la création du produit'));
      } else {
        Alert.alert('Erreur', apiError || 'Erreur lors de la création du produit');
      }
    }
  };

  // Fonction unifiée pour gérer création et mise à jour
  const handleSubmitProduct = async () => {
    if (editingProduct) {
      await handleUpdateProduct();
    } else {
      await handleCreateProduct();
    }
  };

  const selectCategoryForProduct = (category: any) => {
    setNewProduct({
      ...newProduct,
      categoryId: category.id
    });
  };

  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [stockTab, setStockTab] = useState<'modify' | 'history'>('modify');
  const [stockChange, setStockChange] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [showProductModal, setShowProductModal] = useState(false);
  // État pour le formulaire de produit (conforme aux DTOs)
  const [newProduct, setNewProduct] = useState({
    productName: '', // Conforme à NewProductDto
    categoryId: '', // ID de la catégorie sélectionnée
    description: '', // Conforme à NewProductDto
    priceUsd: '', // Prix en USD
    priceCdf: '', // Prix en CDF
    minimalStock: '', // Stock minimum
    imageBase64: 'UkVTVE9NQU5BR0VSQVBQ' // Valeur par défaut valide
  });
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTab, setHistoryTab] = useState<'reaprovision' | 'sorties'>('reaprovision');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<{ reaprovision: any[]; sorties: any[] }>({
    reaprovision: [],
    sorties: []
  });
  const [historyDepotCode, setHistoryDepotCode] = useState<string>('');
  const [historyProduct, setHistoryProduct] = useState<any>(null);
  
  // États pour le formulaire de stock
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockObservation, setStockObservation] = useState('');
  const [stockDepotCode, setStockDepotCode] = useState<string | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockManagementTab, setStockManagementTab] = useState<'adjust' | 'transfer'>('adjust');
  const [stockFeedback, setStockFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [availableDepotCodes, setAvailableDepotCodes] = useState<string[]>([]);
  const [depotCodesLoading, setDepotCodesLoading] = useState(false);
  const [depotCodesError, setDepotCodesError] = useState<string | null>(null);
  const [transferDepotCode, setTransferDepotCode] = useState('');
  const [transferSourceDepotCode, setTransferSourceDepotCode] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('');
  const [transferObservation, setTransferObservation] = useState('');
  const [adjustExpirationDate, setAdjustExpirationDate] = useState<string>('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [destinationProductInfo, setDestinationProductInfo] = useState<{ inStock: number; productName: string } | null>(null);
  const [destinationProductLoading, setDestinationProductLoading] = useState(false);
  const [destinationProductError, setDestinationProductError] = useState<string | null>(null);
  const [sourceProductInfo, setSourceProductInfo] = useState<{ inStock: number; productName: string } | null>(null);
  const [sourceProductLoading, setSourceProductLoading] = useState(false);
  const [sourceProductError, setSourceProductError] = useState<string | null>(null);
  const depotOptions = useMemo(
    () => availableDepotCodes.filter((code) => !!code),
    [availableDepotCodes]
  );

  const filteredDepotCodes = useMemo(
    () =>
      depotOptions.filter((code) => (isAdmin ? true : code !== userDepotCode)),
    [depotOptions, userDepotCode, isAdmin]
  );

  const destinationDepotCodes = isAdmin ? depotOptions : filteredDepotCodes;

  useEffect(() => {
    if (!isAdmin && transferDepotCode && !filteredDepotCodes.includes(transferDepotCode)) {
      setTransferDepotCode('');
    }
  }, [transferDepotCode, filteredDepotCodes, isAdmin]);

  useEffect(() => {
    if (userDepotCode) {
      setStockDepotCode(userDepotCode);
    }
  }, [userDepotCode]);

  useEffect(() => {
    if (isAdmin) {
      setTransferSourceDepotCode('');
    } else {
      setTransferSourceDepotCode(userDepotCode || '');
    }
  }, [isAdmin, userDepotCode]);

  useEffect(() => {
    const fetchDepotCodes = async () => {
      try {
        setDepotCodesLoading(true);
        setDepotCodesError(null);
        const response = await getDepotCodes();
        if (response?.success && Array.isArray(response.data)) {
          setAvailableDepotCodes(response.data);
        } else if (Array.isArray(response)) {
          setAvailableDepotCodes(response);
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
    setStockQuantity('');
    setStockObservation('');
    setTransferQuantity('');
    setTransferObservation('');
    setAdjustExpirationDate('');
    setTransferDepotCode('');
    setTransferSourceDepotCode(isAdmin ? '' : (userDepotCode || ''));
    setStockManagementTab('adjust');
    setDestinationProductInfo(null);
    setDestinationProductError(null);
    setDestinationProductLoading(false);
    setSourceProductInfo(null);
    setSourceProductError(null);
    setSourceProductLoading(false);
  }, [editingProduct, isAdmin, userDepotCode]);

  useEffect(() => {
    setStockFeedback(null);
  }, [stockManagementTab]);

  useEffect(() => {
    if (!editingProduct || stockManagementTab !== 'transfer') {
      setDestinationProductInfo(null);
      setDestinationProductError(null);
      setDestinationProductLoading(false);
      setSourceProductInfo(null);
      setSourceProductError(null);
      setSourceProductLoading(false);
      return;
    }

    let cancelled = false;

    const fetchSourceProduct = async () => {
      try {
        setSourceProductLoading(true);
        setSourceProductError(null);
        const sourceDepot = isAdmin ? transferSourceDepotCode : userDepotCode;
        if (!sourceDepot) {
          setSourceProductInfo(null);
          return;
        }
        const response = await getProductById(editingProduct.id, sourceDepot);
        if (cancelled) return;
        const productData = response?.data?.data ?? response?.data ?? response;
        if (productData && typeof productData === 'object') {
          setSourceProductInfo({
            inStock: Number(productData.inStock) || 0,
            productName: productData.productName || editingProduct.productName || 'Produit'
          });
        } else {
          setSourceProductInfo(null);
        }
      } catch (error: any) {
        if (cancelled) return;
        console.error('Erreur lors du chargement du stock du dépôt source:', error);
        setSourceProductError(error?.message || 'Impossible de récupérer le stock du dépôt source.');
        setSourceProductInfo(null);
      } finally {
        if (!cancelled) {
          setSourceProductLoading(false);
        }
      }
    };

    const fetchDestinationProduct = async () => {
      if (!transferDepotCode) {
        setDestinationProductInfo(null);
        setDestinationProductError(null);
        setDestinationProductLoading(false);
        return;
      }

      try {
        setDestinationProductLoading(true);
        setDestinationProductError(null);
        const response = await getProductById(editingProduct.id, transferDepotCode);
        if (cancelled) return;
        const productData =
          response?.data?.data ??
          response?.data ??
          response;
        if (productData && typeof productData === 'object') {
          setDestinationProductInfo({
            inStock: Number(productData.inStock) || 0,
            productName: productData.productName || editingProduct.productName || 'Produit'
          });
        } else {
          setDestinationProductInfo(null);
        }
      } catch (error: any) {
        if (cancelled) return;
        console.error('Erreur lors du chargement du stock du dépôt destination:', error);
        setDestinationProductError(error?.message || 'Impossible de récupérer le stock du dépôt destination.');
        setDestinationProductInfo(null);
      } finally {
        if (!cancelled) {
          setDestinationProductLoading(false);
        }
      }
    };

    fetchSourceProduct();
    fetchDestinationProduct();

    return () => {
      cancelled = true;
    };
  }, [editingProduct, transferDepotCode, transferSourceDepotCode, stockManagementTab, isAdmin, userDepotCode]);

  useEffect(() => {
    if (!showHistoryModal) {
      return;
    }

    if (isAdmin) {
      if (historyDepotCode && availableDepotCodes.includes(historyDepotCode)) {
        return;
      }
      const fallbackDepot = availableDepotCodes.find((code) => !!code);
      if (fallbackDepot && historyDepotCode !== fallbackDepot) {
        setHistoryDepotCode(fallbackDepot);
      }
    } else if (userDepotCode && historyDepotCode !== userDepotCode) {
      setHistoryDepotCode(userDepotCode);
    }
  }, [showHistoryModal, isAdmin, availableDepotCodes, historyDepotCode, userDepotCode]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!historyProduct?.id) {
        return;
      }
      const depotCode = historyDepotCode || (!isAdmin ? userDepotCode : '');
      if (!depotCode) {
        if (isAdmin) {
          setHistoryError(
            depotOptions.length === 0
              ? 'Aucun dépôt disponible.'
              : "Sélectionnez un dépôt pour afficher l'historique."
          );
          setHistoryData({ reaprovision: [], sorties: [] });
        } else {
          setHistoryError('Aucun dépôt sélectionné.');
          setHistoryData({ reaprovision: [], sorties: [] });
        }
        return;
      }
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await getProductStockHistory(historyProduct.id, depotCode);
        const payload = response?.data || {};
        setHistoryData({
          reaprovision: Array.isArray(payload.reaprovision) ? payload.reaprovision : [],
          sorties: Array.isArray(payload.soties)
            ? payload.soties
            : Array.isArray(payload.sorties)
            ? payload.sorties
            : []
        });
      } catch (error: any) {
        console.error("Erreur lors du chargement de l'historique de stock:", error);
        setHistoryError(error?.message || "Impossible de charger l'historique.");
        setHistoryData({ reaprovision: [], sorties: [] });
      } finally {
        setHistoryLoading(false);
      }
    };

    if (showHistoryModal) {
      loadHistory();
    }
  }, [showHistoryModal, historyDepotCode, historyProduct, isAdmin, userDepotCode, depotOptions]);
  
  // Liste des produits avec images (du POSComponent)
  const menuItems = [
    {
      id: 1,
      name: 'SIMBA Beer',
      price: 8.63,
      image: 'https://th.bing.com/th/id/R.73f863579a37608df9d52a4faad563cc?rik=7xDeJbcPRYRQ%2fQ&pid=ImgRaw&r=0',
      category: 'Boissons',
      quantity: 25,
      unit: 'bouteilles',
      minStock: 10,
      status: 'good'
    },
    {
      id: 2,
      name: 'CASTLE Beer',
      price: 8.05,
      image: 'https://tse2.mm.bing.net/th/id/OIP.jgD_Xqvy4PGJNUZj--eb1AHaJo?rs=1&pid=ImgDetMain&o=7&rm=3',
      category: 'Boissons',
      quantity: 5,
      unit: 'bouteilles',
      minStock: 8,
      status: 'low'
    },
    {
      id: 3,
      name: 'JACK DANIEL S Single Barrel 45% Heritage Whisky',
      price: 3.45,
      image: 'https://th.bing.com/th/id/R.0c93f8c9a0f329837b0c0e4dd6c1638c?rik=DOy%2f4Hqk982h7Q&pid=ImgRaw&r=0',
      category: 'Boissons',
      quantity: 15,
      unit: 'bouteilles',
      minStock: 5,
      status: 'good'
    },
    {
      id: 4,
      name: 'Amarula 375ml | Bar Keeper',
      price: 3.91,
      image: 'https://tse2.mm.bing.net/th/id/OIP.UjgVJ9ce4zcwOwr8LxKKSAHaHa?rs=1&pid=ImgDetMain&o=7&rm=3',
      category: 'Boissons',
      quantity: 2,
      unit: 'bouteilles',
      minStock: 3,
      status: 'low'
    },
    {
      id: 5,
      name: 'Bottle of Wine - Pentax',
      price: 8.05,
      image: 'https://th.bing.com/th/id/R.ac87a3e239a5a5cbab14d3d71d9a9d33?rik=CGoRSZcqluHCOw&riu=http%3a%2f%2fwww.pentaxforums.com%2fgallery%2fimages%2f5744%2f1_Bottle_of_Wine.jpg&ehk=ww9dq%2bY7zYhW6Yn89ijLNr8yTbJzqPkJ2QHY7me2uxg%3d&risl=&pid=ImgRaw&r=0',
      category: 'Boissons',
      quantity: 8,
      unit: 'bouteilles',
      minStock: 5,
      status: 'good'
    },
    {
      id: 6,
      name: 'Lunch M 18pc',
      price: 13.80,
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
      category: 'Plats',
      quantity: 1,
      unit: 'portions',
      minStock: 2,
      status: 'critical'
    },
    {
      id: 7,
      name: 'Lunch Salmon 20pc',
      price: 15.87,
      image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
      category: 'Plats',
      quantity: 12,
      unit: 'portions',
      minStock: 6,
      status: 'good'
    },
    {
      id: 8,
      name: 'Lunch Temaki mix 3pc',
      price: 16.10,
      image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80',
      category: 'Plats',
      quantity: 4,
      unit: 'portions',
      minStock: 8,
      status: 'low'
    },
    {
      id: 9,
      name: 'Margherita',
      price: 8.05,
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
      category: 'Pizzas',
      quantity: 8,
      unit: 'pizzas',
      minStock: 5,
      status: 'good'
    },
    {
      id: 10,
      name: 'Mozzarella Sandwich',
      price: 4.49,
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
      category: 'Sandwichs',
      quantity: 6,
      unit: 'sandwichs',
      minStock: 4,
      status: 'good'
    },
    {
      id: 11,
      name: 'Pasta 4 formaggi',
      price: 6.33,
      image: 'https://images.unsplash.com/photo-1523987355523-c7b5b0723c6a?auto=format&fit=crop&w=400&q=80',
      category: 'Pâtes',
      quantity: 3,
      unit: 'portions',
      minStock: 5,
      status: 'low'
    },
    {
      id: 12,
      name: 'Pasta Bolognese',
      price: 5.18,
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
      category: 'Pâtes',
      quantity: 7,
      unit: 'portions',
      minStock: 4,
      status: 'good'
    },
    {
      id: 13,
      name: 'Salmon and Avocado',
      price: 10.64,
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
      category: 'Sushis',
      quantity: 2,
      unit: 'portions',
      minStock: 3,
      status: 'low'
    },
    {
      id: 14,
      name: 'Spicy Tuna Sandwich',
      price: 3.45,
      image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80',
      category: 'Sandwichs',
      quantity: 5,
      unit: 'sandwichs',
      minStock: 3,
      status: 'good'
    },
    {
      id: 15,
      name: 'Vegetarian',
      price: 8.05,
      image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
      category: 'Pizzas',
      quantity: 9,
      unit: 'pizzas',
      minStock: 6,
      status: 'good'
    },
    {
      id: 16,
      name: 'Ice Tea',
      price: 2.53,
      image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
      category: 'Boissons',
      quantity: 20,
      unit: 'bouteilles',
      minStock: 10,
      status: 'good'
    },
    {
      id: 17,
      name: 'Coca-Cola',
      price: 2.00,
      image: 'https://tse3.mm.bing.net/th/id/OIP.UhLiDYoAoCDoeiMyy8tYwgHaHa?w=840&h=840&rs=1&pid=ImgDetMain&o=7&rm=3',
      category: 'Boissons',
      quantity: 15,
      unit: 'bouteilles',
      minStock: 8,
      status: 'good'
    },
    {
      id: 18,
      name: 'Eau minérale',
      price: 1.50,
      image: 'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=400&q=80',
      category: 'Boissons',
      quantity: 30,
      unit: 'bouteilles',
      minStock: 15,
      status: 'good'
    }
  ];

  const inventoryItems = menuItems;

  // Catégories statiques pour les produits (à remplacer par l'API plus tard)
  const staticCategories = [
    { id: 1, name: 'Boissons', description: 'Boissons alcoolisées et non-alcoolisées', color: '#3B82F6' },
    { id: 2, name: 'Plats', description: 'Plats principaux et spécialités', color: '#10B981' },
    { id: 3, name: 'Pizzas', description: 'Pizzas et variations', color: '#F59E0B' },
    { id: 4, name: 'Sandwichs', description: 'Sandwichs et paninis', color: '#8B5CF6' },
    { id: 5, name: 'Pâtes', description: 'Pâtes et accompagnements', color: '#EF4444' },
    { id: 6, name: 'Sushis', description: 'Sushis et spécialités japonaises', color: '#06B6D4' }
  ];

  // Obtenir toutes les catégories uniques des produits
  const allCategories = ['Toutes', ...new Set(inventoryItems.map(item => item.category))];

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Toutes' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return '#10B981';
      case 'low': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'good': return 'Stock OK';
      case 'low': return 'Stock faible';
      case 'critical': return 'Stock critique';
      default: return 'Inconnu';
    }
  };

  const formatDateTime = (dateString?: string | null) => {
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleString();
  };

const toIsoWithZulu = (dateString?: string) => {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString();
};

  const openCategoryModal = () => {
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setNewCategory({
      categoryName: '',
      description: ''
    });
  };

  const createStaticCategory = () => {
    if (newCategory.categoryName.trim()) {
      // Ici on pourrait ajouter la logique pour sauvegarder la catégorie
      closeCategoryModal();
    }
  };

  const editStaticCategory = (category: any) => {
    setEditingCategory(category);
    setNewCategory({
      categoryName: category.name,
      description: category.description
    });
  };

  const updateStaticCategory = () => {
    if (newCategory.categoryName.trim() && editingCategory) {
      // Ici on pourrait ajouter la logique pour mettre à jour la catégorie
      setEditingCategory(null);
      closeCategoryModal();
    }
  };

  const selectProductForEdit = (product: any) => {
    setEditingProduct(product);
    setNewProduct({
      productName: product.productName || product.name || '',
      categoryId: product.categoryId || product.category?.id || product.category || '',
      priceUsd: (product.priceUsd || product.price || 0).toString(),
      priceCdf: (product.priceCdf || 0).toString(),
      minimalStock: (product.minimalStock || product.minStock || 0).toString(),
      imageBase64: product.imageBase64 || product.image || 'UkVTVE9NQU5BR0VSQVBQ',
      description: product.description || ''
    });
    setActiveTab('product-management');
    setStockFeedback(null);
  };

  const openHistoryModal = (product: any) => {
    setHistoryProduct(product);
    setHistoryTab('reaprovision');
    setHistoryData({ reaprovision: [], sorties: [] });
    setHistoryError(null);
    setShowHistoryModal(true);
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryProduct(null);
    setHistoryDepotCode('');
    setHistoryData({ reaprovision: [], sorties: [] });
    setHistoryError(null);
    setHistoryLoading(false);
  };

  const openProductModal = () => {
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setNewProduct({
      productName: '',
      categoryId: '',
      priceUsd: '',
      priceCdf: '',
      minimalStock: '',
      imageBase64: 'UkVTVE9NQU5BR0VSQVBQ',
      description: ''
    });
    // Réinitialiser le formulaire de stock
    setStockQuantity('');
    setStockObservation('');
    setStockDepotCode(userDepotCode ?? null);
    setTransferQuantity('');
    setTransferObservation('');
    setAdjustExpirationDate('');
    setTransferDepotCode('');
    setTransferSourceDepotCode(isAdmin ? '' : (userDepotCode || ''));
    setStockFeedback(null);
  };

  // Fonctions pour la gestion du stock
  const handleStockAction = async (action: 'add' | 'remove') => {
    setStockFeedback(null);

    const quantity = parseInt(stockQuantity, 10);

    if (!stockQuantity || isNaN(quantity) || quantity <= 0) {
      setStockFeedback({
        type: 'error',
        message: 'La quantité doit être un nombre supérieur à zéro.',
      });
      return;
    }

    if (!editingProduct) {
      setStockFeedback({
        type: 'error',
        message: 'Aucun produit sélectionné.',
      });
      return;
    }

    if (action === 'remove') {
      const currentStock = editingProduct?.inStock || 0;
      if (quantity > currentStock) {
        setStockFeedback({
          type: 'error',
          message: `Vous ne pouvez pas retirer ${quantity} unité(s). Le stock actuel est de ${currentStock} unité(s).`,
        });
        return;
      }
    }

    const effectiveDepotCode = stockDepotCode || userDepotCode;

    if (!effectiveDepotCode) {
      setStockFeedback({
        type: 'error',
        message: 'Veuillez sélectionner un dépôt.',
      });
      return;
    }

    if (action === 'add' && !adjustExpirationDate) {
      setStockFeedback({
        type: 'error',
        message: "Veuillez sélectionner une date d'expiration.",
      });
      return;
    }

    const userData = await getUserData();
    if (!userData || !userData.id) {
      setStockFeedback({
        type: 'error',
        message: 'Utilisateur non connecté ou ID utilisateur manquant.',
      });
      return;
    }

    const stockData: any = {
      productId: editingProduct.id,
      userId: userData.id,
      depotCode: effectiveDepotCode,
      qte: quantity,
      observation: stockObservation || null,
    };
    if (action === 'add') {
      stockData.expirationDate = toIsoWithZulu(adjustExpirationDate);
    }

    try {
      setStockLoading(true);

      if (action === 'add') {
        await reapprovisionStock(stockData);
      } else {
        await sortieStock(stockData);
      }

      setStockFeedback({
        type: 'success',
        message: `Stock ${action === 'add' ? 'ajouté' : 'retiré'} avec succès.`,
      });

      setEditingProduct((prev: any) => {
        if (!prev) return prev;
        const current = prev.inStock || 0;
        const nextValue =
          action === 'add'
            ? current + quantity
            : Math.max(0, current - quantity);
        return { ...prev, inStock: nextValue };
      });

      setStockQuantity('');
      setStockObservation('');
      setStockDepotCode(userDepotCode ?? null);
      setAdjustExpirationDate('');

      refetchProducts();
    } catch (error: any) {
      console.error(`Erreur lors de l'${action === 'add' ? 'ajout' : 'retrait'} du stock:`, error);
      setStockFeedback({
        type: 'error',
        message: error?.message
          ? `Erreur : ${error.message}`
          : `Erreur lors de l'${action === 'add' ? 'ajout' : 'retrait'} du stock.`,
      });
    } finally {
      setStockLoading(false);
    }
  };

  const confirmStockAction = (action: 'add' | 'remove') => {
    setStockFeedback(null);

    const quantity = parseInt(stockQuantity, 10);
    const actionText = action === 'add' ? 'ajouter' : 'retirer';
    const actionTitle = action === 'add' ? 'Ajouter au stock' : 'Retirer du stock';

    if (!stockQuantity || isNaN(quantity) || quantity <= 0) {
      setStockFeedback({
        type: 'error',
        message: 'Veuillez saisir une quantité valide à ajuster.',
      });
      return;
    }

    if (!editingProduct) {
      setStockFeedback({
        type: 'error',
        message: 'Aucun produit sélectionné.',
      });
      return;
    }

    const currentStock = editingProduct?.inStock || 0;
    if (action === 'remove' && quantity > currentStock) {
      setStockFeedback({
        type: 'error',
        message: `Vous ne pouvez pas retirer ${quantity} unité(s). Le stock actuel est de ${currentStock} unité(s).`,
      });
      return;
    }

    const depotLabel = stockDepotCode || userDepotCode;
    if (!depotLabel) {
      setStockFeedback({
        type: 'error',
        message: 'Veuillez sélectionner un dépôt.',
      });
      return;
    }

    if (action === 'add' && !adjustExpirationDate) {
      setStockFeedback({
        type: 'error',
        message: "Veuillez sélectionner une date d'expiration.",
      });
      return;
    }

    const productLabel = editingProduct?.name || editingProduct?.productName || 'ce produit';
    const message = `Êtes-vous sûr de vouloir ${actionText} ${quantity} unité(s) du stock pour "${productLabel}" ?${stockObservation ? `\n\nObservation: ${stockObservation}` : ''}\n\nDépôt: ${depotLabel}${
      action === 'add' ? `\n\nDate d'expiration: ${formatDateTime(adjustExpirationDate)}` : ''
    }`;

    const isWeb = typeof window !== 'undefined' && typeof window.confirm === 'function';

    if (isWeb) {
      const confirmed = window.confirm(`${actionTitle}\n\n${message}`);
      if (confirmed) {
        handleStockAction(action);
      }
    } else {
      Alert.alert(
        actionTitle,
        message,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: action === 'add' ? 'Ajouter' : 'Retirer',
            style: action === 'add' ? 'default' : 'destructive',
            onPress: () => handleStockAction(action),
          },
        ]
      );
    }
  };

  const handleTransferStock = async () => {
    const isWebAlert = typeof window !== 'undefined' && typeof window.alert === 'function';

    if (!editingProduct) {
      const message = 'Produit introuvable pour le transfert.';
      if (isWebAlert) {
        window.alert(`❌ Erreur : ${message}`);
      } else {
        Alert.alert('Erreur', message);
      }
      return;
    }

    const quantity = parseInt(transferQuantity, 10);
    try {
      setTransferLoading(true);

      const userData = await getUserData();
      if (!userData || !userData.id) {
        if (isWebAlert) {
          window.alert('❌ Erreur : Utilisateur non connecté ou ID utilisateur manquant');
        } else {
          Alert.alert('Erreur', 'Utilisateur non connecté ou ID utilisateur manquant');
        }
        return;
      }

      const sourceDepotCode = isAdmin ? transferSourceDepotCode : userDepotCode;
      if (!sourceDepotCode) {
        const message = 'Code dépôt source introuvable.';
        if (isWebAlert) {
          window.alert(`❌ Erreur : ${message}`);
        } else {
          Alert.alert('Erreur', message);
        }
        return;
      }

      if (!transferDepotCode) {
        const message = 'Veuillez sélectionner un dépôt de destination.';
        if (isWebAlert) {
          window.alert(`❌ Erreur : ${message}`);
        } else {
          Alert.alert('Erreur', message);
        }
        return;
      }

      const payload = {
        productId: editingProduct.id,
        userId: userData.id,
        fromDepotCode: sourceDepotCode,
        toDepotCode: transferDepotCode,
        qte: quantity,
        observation: transferObservation || null,
      };
      console.log(payload);

      await transferStock(payload);

      const successMessage = 'Transfert de stock effectué avec succès';
      if (isWebAlert) {
        window.alert(`✅ Succès ! ${successMessage}`);
      } else {
        Alert.alert('Succès', successMessage);
      }

      setEditingProduct((prev: any) => {
        if (!prev) return prev;
        const current = prev.inStock || 0;
        const nextValue = Math.max(0, current - quantity);
        return { ...prev, inStock: nextValue };
      });

      setTransferQuantity('');
      setTransferObservation('');
      setTransferDepotCode('');
      setTransferSourceDepotCode(isAdmin ? '' : (userDepotCode || ''));

      refetchProducts();
    } catch (error: any) {
      console.error('Erreur lors du transfert de stock:', error);
      const errorMessage = error?.message || 'Erreur lors du transfert de stock';
      if (isWebAlert) {
        window.alert(`❌ Erreur : ${errorMessage}`);
      } else {
        Alert.alert('Erreur', errorMessage);
      }
    } finally {
      setTransferLoading(false);
    }
  };

  const confirmTransferStock = () => {
    const quantity = parseInt(transferQuantity, 10);
    const currentStock = editingProduct?.inStock || 0;
    const isWebAlert = typeof window !== 'undefined' && typeof window.alert === 'function';

    if (!transferQuantity || isNaN(quantity) || quantity <= 0) {
      const message = 'Veuillez saisir une quantité valide à transférer.';
      if (isWebAlert) {
        window.alert(`❌ Erreur : ${message}`);
      } else {
        Alert.alert('Erreur', message);
      }
      return;
    }

    if (quantity > currentStock) {
      const message = `Vous ne pouvez pas transférer ${quantity} unité(s). Le stock actuel est de ${currentStock} unité(s).`;
      if (isWebAlert) {
        window.alert(`❌ Erreur : ${message}`);
      } else {
        Alert.alert('Erreur', message);
      }
      return;
    }

    const sourceDepot = isAdmin ? transferSourceDepotCode : userDepotCode;
    if (!sourceDepot) {
      const message = isAdmin
        ? 'Veuillez sélectionner un dépôt source.'
        : 'Code dépôt de l’utilisateur introuvable.';
      if (isWebAlert) {
        window.alert(`❌ Erreur : ${message}`);
      } else {
        Alert.alert('Erreur', message);
      }
      return;
    }

    if (!transferDepotCode) {
      const message = 'Veuillez sélectionner un dépôt de destination.';
      if (isWebAlert) {
        window.alert(`❌ Erreur : ${message}`);
      } else {
        Alert.alert('Erreur', message);
      }
      return;
    }

    if (transferDepotCode === sourceDepot) {
      const message = 'Le dépôt de destination doit être différent du dépôt de départ.';
      if (isWebAlert) {
        window.alert(`❌ Erreur : ${message}`);
      } else {
        Alert.alert('Erreur', message);
      }
      return;
    }

    const productName = editingProduct?.name || editingProduct?.productName || 'ce produit';
    const details = `Êtes-vous sûr de vouloir transférer ${quantity} unité(s) de "${productName}" du dépôt ${sourceDepot} vers ${transferDepotCode} ?${transferObservation ? `\n\nObservation : ${transferObservation}` : ''}`;
    const isWebConfirm = typeof window !== 'undefined' && typeof window.confirm === 'function';

    if (isWebConfirm) {
      const confirmed = window.confirm(`Transférer le stock\n\n${details}`);
      if (confirmed) {
        handleTransferStock();
      }
    } else {
      Alert.alert(
        'Transférer le stock',
        details,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Transférer', onPress: () => handleTransferStock() },
        ]
      );
    }
  };


  const pickImage = () => {
    if (isLargeScreen) {
      // Pour le web, on peut utiliser un input file
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            setNewProduct({...newProduct, imageBase64: event.target.result});
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      // Pour mobile, utiliser ImagePicker
      Alert.alert(
        'Sélectionner une image',
        'Choisissez une option',
        [
          {
            text: 'Galerie',
            onPress: () => {
              // Ici on utiliserait ImagePicker pour mobile
            }
          },
          {
            text: 'Caméra',
            onPress: () => {
              // Ici on utiliserait ImagePicker pour la caméra
            }
          },
          {
            text: 'Annuler',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const categoryColors = [
    '#7C3AED', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1', '#14B8A6'
  ];

  const inventoryTabsConfig: Array<{
    key: 'products' | 'categories' | 'product-management';
    label: string;
    mobileLabel: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    {
      key: 'products',
      label: 'Liste des produits',
      mobileLabel: 'Produits',
      icon: 'list'
    },
    {
      key: 'categories',
      label: 'Gestion catégories',
      mobileLabel: 'Catégories',
      icon: 'folder'
    },
    {
      key: 'product-management',
      label: 'Gestion des produits',
      mobileLabel: 'Gestion',
      icon: 'settings'
    }
  ];

  const openStockModal = (product: any) => {
    setSelectedProduct(product);
    setStockChange('');
    setStockNote('');
    setStockTab('modify');
    setShowStockModal(true);
  };

  const closeStockModal = () => {
    setShowStockModal(false);
    setSelectedProduct(null);
    setStockChange('');
    setStockNote('');
  };

  const updateStock = (action: 'increase' | 'decrease') => {
    if (selectedProduct && stockChange) {
      const change = parseInt(stockChange);
      if (!isNaN(change) && change > 0) {
        const newQuantity = action === 'increase' 
          ? selectedProduct.quantity + change 
          : selectedProduct.quantity - change;
        
        if (newQuantity >= 0) {
          // Ici on pourrait mettre à jour la base de données
          closeStockModal();
        }
      }
    }
  };

  // Données d'historique d'approvisionnement (mock)
  const stockHistory = [
    { id: 1, date: '2024-01-15', type: 'increase', quantity: 50, reason: 'Commande fournisseur', user: 'Admin' },
    { id: 2, date: '2024-01-10', type: 'decrease', quantity: 25, reason: 'Vente', user: 'Serveur 1' },
    { id: 3, date: '2024-01-08', type: 'increase', quantity: 30, reason: 'Réapprovisionnement', user: 'Admin' },
    { id: 4, date: '2024-01-05', type: 'decrease', quantity: 15, reason: 'Vente', user: 'Serveur 2' },
    { id: 5, date: '2024-01-01', type: 'increase', quantity: 40, reason: 'Stock initial', user: 'Admin' }
  ];

  const currentHistoryItems = historyTab === 'reaprovision' ? historyData.reaprovision : historyData.sorties;
  const historyDepotDisplay = historyDepotCode || (!isAdmin ? userDepotCode || '' : '');
const historyModal = (
    <Modal
      visible={showHistoryModal}
      onRequestClose={closeHistoryModal}
      animationType="fade"
      transparent
    >
      <View style={styles.historyModalOverlay}>
        <View
          style={[
            styles.historyModalContent,
            isLargeScreen ? styles.historyModalContentWeb : styles.historyModalContentMobile
          ]}
        >
          <View style={styles.historyModalHeader}>
            <View style={styles.historyModalTitleBlock}>
              <Text style={styles.historyModalTitle}>Historique du stock</Text>
              {historyProduct?.productName ? (
                <Text style={styles.historyModalSubtitle}>{historyProduct.productName}</Text>
              ) : null}
              {historyDepotDisplay ? (
                <Text style={styles.historyDepotInfo}>Dépôt actif : {historyDepotDisplay}</Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.historyModalCloseButton} onPress={closeHistoryModal}>
              <Ionicons name="close" size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <View style={styles.historyModalBody}>
            {isAdmin ? (
              <View style={styles.historyDepotSelector}>
                <Text style={styles.historyDepotLabel}>Sélectionner un dépôt</Text>
                {depotOptions.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.historyDepotChips}>
                      {depotOptions.map((code) => (
                        <TouchableOpacity
                          key={code}
                          style={[
                            styles.historyDepotChip,
                            historyDepotCode === code && styles.historyDepotChipActive
                          ]}
                          onPress={() => setHistoryDepotCode(code)}
                        >
                          <Text
                            style={[
                              styles.historyDepotChipText,
                              historyDepotCode === code && styles.historyDepotChipTextActive
                            ]}
                          >
                            {code}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <Text style={styles.historyDepotValue}>Aucun dépôt disponible</Text>
                )}
              </View>
            ) : (
              <View style={styles.historyDepotSelector}>
                <Text style={styles.historyDepotLabel}>Dépôt</Text>
                <Text style={styles.historyDepotValue}>{historyDepotDisplay || 'Non défini'}</Text>
              </View>
            )}

            <View style={styles.historyTabs}>
              <TouchableOpacity
                style={[
                  styles.historyTabButton,
                  historyTab === 'reaprovision' && styles.historyTabButtonActive
                ]}
                onPress={() => setHistoryTab('reaprovision')}
              >
                <Text
                  style={[
                    styles.historyTabButtonText,
                    historyTab === 'reaprovision' && styles.historyTabButtonTextActive
                  ]}
                >
                  Approvisionnements
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.historyTabButton,
                  historyTab === 'sorties' && styles.historyTabButtonActive
                ]}
                onPress={() => setHistoryTab('sorties')}
              >
                <Text
                  style={[
                    styles.historyTabButtonText,
                    historyTab === 'sorties' && styles.historyTabButtonTextActive
                  ]}
                >
                  Sorties
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.historySummary}>
              <Text style={styles.historySummaryText}>
                {historyLoading
                  ? 'Chargement en cours...'
                  : historyError
                  ? 'Erreur de chargement'
                  : `Total ${historyTab === 'reaprovision' ? 'approvisionnements' : 'sorties'} : ${
                      currentHistoryItems.length
                    }`}
              </Text>
              <Text style={styles.historySummaryCount}>
                {currentHistoryItems.length} enregistrement{currentHistoryItems.length > 1 ? 's' : ''}
              </Text>
            </View>

            <ScrollView
              style={styles.historyModalScroll}
              contentContainerStyle={styles.historyListContent}
            >
              {historyLoading ? (
                <View style={styles.historyLoadingContainer}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={styles.historySummaryText}>Chargement de l'historique...</Text>
                </View>
              ) : historyError ? (
                <Text style={styles.historyErrorText}>{historyError}</Text>
              ) : currentHistoryItems.length === 0 ? (
                <View style={styles.historyEmptyContainer}>
                  <Ionicons name="time-outline" size={32} color="#9CA3AF" />
                  <Text style={styles.historyEmptyText}>Aucun enregistrement trouvé pour ce dépôt.</Text>
                </View>
              ) : (
                currentHistoryItems.map((entry: any, index: number) => {
                  const expirationDateValue =
                    entry?.expirationDate && entry.expirationDate !== '0001-01-01T00:00:00'
                      ? entry.expirationDate
                      : entry?.product?.expirationDate;
                  let showExpiryBadge = false;
                  if (historyTab === 'reaprovision' && expirationDateValue) {
                    const expiryDate = new Date(expirationDateValue);
                    if (!Number.isNaN(expiryDate.getTime())) {
                      const sixMonthsFromNow = new Date();
                      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
                      showExpiryBadge = expiryDate <= sixMonthsFromNow;
                    }
                  }

                  return (
                    <View key={`${historyTab}-${index}`} style={styles.historyCard}>
                      <View style={styles.historyCardHeader}>
                        <Text style={styles.historyCardTitle}>
                          {entry?.user?.username || 'Utilisateur inconnu'}
                        </Text>
                        <View style={styles.historyCardHeaderRight}>
                          {showExpiryBadge ? (
                            <View style={styles.expiryBadge}>
                              <Text style={styles.expiryBadgeText}>Expiration</Text>
                            </View>
                          ) : null}
                          <Text style={styles.historyCardQty}>{entry?.qte ?? 0} u.</Text>
                        </View>
                      </View>
                      <Text style={styles.historyCardMeta}>
                        Dépôt : {entry?.user?.depotCode || entry?.depotCode || 'N/A'}
                      </Text>
                      <Text style={styles.historyCardMeta}>
                        Créé le : {formatDateTime(entry?.user?.created)}
                      </Text>
                      <Text style={styles.historyCardMeta}>
                        Date d'expiration : {formatDateTime(expirationDateValue)}
                      </Text>
                      {entry?.observation ? (
                        <Text style={styles.historyCardObservation}>
                          Observation : {entry.observation}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <>
        <ScrollView style={[styles.containerWeb, {paddingHorizontal: 140}]}>
          <Text style={styles.titleWeb}>Inventaire</Text>
        
        {/* Onglets */}
        <View style={styles.tabsPillContainerWeb}>
          {inventoryTabsConfig.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButtonWeb,
                activeTab === tab.key && styles.tabButtonWebActive
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={activeTab === tab.key ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.tabButtonTextWeb,
                  activeTab === tab.key && styles.tabButtonTextWebActive
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contenu des onglets */}
        {activeTab === 'products' && (
          <View>
            {/* États de chargement et erreurs */}
            {(categoriesLoading || productsLoading) && (
              <View style={styles.loadingContainerWeb}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingTextWeb}>Chargement des données...</Text>
              </View>
            )}

            {(categoriesError || productsError) && (
              <View style={styles.errorContainerWeb}>
                <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                <Text style={styles.errorTextWeb}>{categoriesError || productsError}</Text>
                <TouchableOpacity 
                  style={styles.retryButtonWeb} 
                  onPress={() => {
                    refetchCategories();
                    refetchProducts();
                  }}
                >
                  <Text style={styles.retryButtonTextWeb}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {!categoriesLoading && !productsLoading && !categoriesError && !productsError && (
              <>
            {/* Barre de recherche et filtres */}
        <View style={styles.searchContainerWeb}>
          <View style={styles.searchBarWeb}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput 
              placeholder="Rechercher un produit..." 
              style={styles.searchInputWeb}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity 
            style={styles.refreshButtonWeb}
            onPress={() => {
              refetchCategories();
              refetchProducts();
            }}
            disabled={categoriesLoading || productsLoading}
          >
            {(categoriesLoading || productsLoading) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>

              {/* Filtres par catégorie */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFiltersWeb}>
                  <TouchableOpacity
                    style={[
                      styles.categoryFilterWeb,
                        selectedCategory === 'Toutes' && styles.categoryFilterActiveWeb
                    ]}
                      onPress={() => setSelectedCategory('Toutes')}
                  >
                    <Text style={[
                      styles.categoryFilterTextWeb,
                        selectedCategory === 'Toutes' && styles.categoryFilterTextActiveWeb
                      ]}>
                        Toutes
                      </Text>
                    </TouchableOpacity>
                    {categories.map((category: any) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryFilterWeb,
                          selectedCategory === category.categoryName && styles.categoryFilterActiveWeb
                        ]}
                        onPress={() => setSelectedCategory(category.categoryName)}
                      >
                        <Text style={[
                          styles.categoryFilterTextWeb,
                          selectedCategory === category.categoryName && styles.categoryFilterTextActiveWeb
                        ]}>
                          {category.categoryName}
                    </Text>
          </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Table des produits */}
                <View style={styles.tableContainerWeb}>
                  <View style={styles.tableHeaderWeb}>
                    <Text style={styles.tableHeaderTextWeb}>Produit</Text>
                    <Text style={styles.tableHeaderTextWeb}>Catégorie</Text>
                    <Text style={styles.tableHeaderTextWeb}>Prix USD</Text>
                    <Text style={styles.tableHeaderTextWeb}>Prix CDF</Text>
                    <Text style={styles.tableHeaderTextWeb}>Stock</Text>
                    <Text style={styles.tableHeaderTextWeb}>Actions</Text>
                  </View>
                  
                  {products.length === 0 ? (
                    <View style={styles.emptyStateWeb}>
                      <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
                      <Text style={styles.emptyStateTextWeb}>Aucun produit trouvé</Text>
                      <Text style={styles.emptyStateSubtextWeb}>Commencez par créer un produit</Text>
                    </View>
                  ) : (
                    products
                      .filter((product: any) => {
                        // Filtre par recherche
                        const matchesSearch = searchQuery === '' || 
                          product.productName.toLowerCase().includes(searchQuery.toLowerCase());
                        
                        // Filtre par catégorie
                        const matchesCategory = selectedCategory === 'Toutes' || 
                          product.category?.categoryName === selectedCategory;
                        
                        return matchesSearch && matchesCategory;
                      })
                      .map((product: any) => (
                        <View key={product.id} style={styles.tableRowWeb}>
                          <View style={styles.productCellWeb}>
                            <View style={styles.productIconWeb}>
                              <Ionicons name="cube-outline" size={24} color="#6B7280" />
                            </View>
                            <View>
                              <Text style={styles.productNameWeb}>{product.productName}</Text>
                              <Text style={styles.productUnitWeb}>{product.description || 'Aucune description'}</Text>
                            </View>
                          </View>
                          <Text style={styles.categoryCellWeb}>{product.category?.categoryName || 'N/A'}</Text>
                          <Text style={styles.priceCellWeb}>${product.priceUsd}</Text>
                          <Text style={styles.priceCellWeb}>{product.priceCdf} CDF</Text>
                          <Text style={styles.stockCellWeb}>{product.inStock || 0}</Text>
                          <View style={styles.actionsCellWeb}>
                            <TouchableOpacity
                              style={[styles.actionButtonWeb, styles.historyButtonWeb]}
                              onPress={() => openHistoryModal(product)}
                            >
                              <Ionicons name="time-outline" size={16} color="#2563EB" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.actionButtonWeb} 
                              onPress={() => selectProductForEdit(product)}
                            >
                              <Ionicons name="create-outline" size={16} color="#3B82F6" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={[styles.actionButtonWeb, styles.deleteButtonWeb]} 
                              onPress={() => {
                                if (isLargeScreen) {
                                  window.alert('Fonction de suppression à implémenter');
                                } else {
                                  Alert.alert('Info', 'Fonction de suppression à implémenter');
                                }
                              }}
                            >
                              <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                  )}
                </View>

                
              </>
            )}
          </View>
        )}

        {activeTab === 'categories' && (
          <View>
            {/* États de chargement et erreurs */}
            {categoriesLoading && (
              <View style={styles.loadingContainerWeb}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingTextWeb}>Chargement des catégories...</Text>
              </View>
            )}

            {categoriesError && (
              <View style={styles.errorContainerWeb}>
                <Ionicons name="alert-circle-outline" size={24} color="#EF4444" />
                <Text style={styles.errorTextWeb}>{categoriesError}</Text>
                <TouchableOpacity 
                  style={styles.retryButtonWeb} 
                  onPress={() => refetchCategories()}
                >
                  <Text style={styles.retryButtonTextWeb}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            )}

            {!categoriesLoading && !categoriesError && (
              <>
            {/* Formulaire de catégorie */}
            <View style={styles.formContainerWeb}>
              <Text style={styles.formTitleWeb}>
                {editingCategory ? 'Modifier la catégorie' : 'Créer une nouvelle catégorie'}
              </Text>
              
                <View style={styles.formGroupWeb}>
                    <Text style={styles.formLabelWeb}>Nom de la catégorie *</Text>
                  <TextInput
                    style={styles.formInputWeb}
                      value={newCategory.categoryName}
                      onChangeText={(text) => setNewCategory({...newCategory, categoryName: text})}
                    placeholder="Ex: Boissons"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              
              <View style={styles.formGroupWeb}>
                <Text style={styles.formLabelWeb}>Description</Text>
                <TextInput
                  style={[styles.formInputWeb, styles.textAreaWeb]}
                  value={newCategory.description}
                  onChangeText={(text) => setNewCategory({...newCategory, description: text})}
                  placeholder="Description de la catégorie..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                />
              </View>
              
              <View style={styles.formActionsWeb}>
                {editingCategory && (
                <TouchableOpacity 
                    style={styles.cancelButtonWeb} 
                    onPress={() => {
                      setEditingCategory(null);
                          setNewCategory({ categoryName: '', description: '' });
                    }}
                  >
                    <Text style={styles.cancelButtonTextWeb}>Annuler</Text>
                </TouchableOpacity>
                )}
                <TouchableOpacity 
                      style={[styles.submitButtonWeb, apiLoading && styles.disabledButtonWeb]} 
                      onPress={editingCategory ? handleUpdateCategory : handleCreateCategory}
                      disabled={apiLoading}
                >
                      {apiLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                  <Text style={styles.submitButtonTextWeb}>
                    {editingCategory ? 'Mettre à jour' : 'Créer'}
                  </Text>
                      )}
                </TouchableOpacity>
              </View>
              </View>

            {/* Table des catégories */}
            <View style={styles.tableContainerWeb}>
              <View style={styles.tableHeaderWeb}>
                <Text style={styles.tableHeaderTextWeb}>Nom</Text>
                <Text style={styles.tableHeaderTextWeb}>Description</Text>
                <Text style={styles.tableHeaderTextWeb}>Actions</Text>
                    </View>

                  {categories && categories.length === 0 ? (
                    <View style={styles.emptyStateWeb}>
                      <Ionicons name="folder-outline" size={48} color="#9CA3AF" />
                      <Text style={styles.emptyStateTextWeb}>Aucune catégorie trouvée</Text>
                      <Text style={styles.emptyStateSubtextWeb}>Commencez par créer une catégorie</Text>
                    </View>
                  ) : (
                    categories?.map((category: any) => (
                <View key={category.id} style={styles.tableRowWeb}>
                        <Text style={styles.categoryNameWeb}>{category.categoryName}</Text>
                  <Text style={styles.categoryDescriptionWeb}>{category.description}</Text>
                  <View style={styles.actionsCellWeb}>
                        <TouchableOpacity 
                      style={styles.actionButtonWeb} 
                      onPress={() => editCategory(category)}
                    >
                      <Ionicons name="create-outline" size={16} color="#3B82F6" />
                        </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.actionButtonWeb, styles.deleteButtonWeb]} 
                            onPress={() => handleDeleteCategory(category)}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                          </View>
                    ))
                  )}
            </View>
              </>
            )}
          </View>
        )}

        {activeTab === 'product-management' && (
          <View>
            {/* Formulaire de produit */}
            <View style={styles.formContainerWeb}>
              <Text style={styles.formTitleWeb}>
                {editingProduct ? 'Modifier le produit' : 'Créer un nouveau produit'}
              </Text>
              
              {/* Sélecteur de catégories */}
              <View style={styles.categorySelectorContainerWeb}>
                <Text style={styles.categorySelectorLabelWeb}>Sélectionner une catégorie :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelectorWeb}>
                   {categories.map((category: any) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categorySelectorItemWeb,
                         { backgroundColor: '#3B82F620', borderColor: '#3B82F6' },
                         newProduct.categoryId === category.id && styles.categorySelectorItemActiveWeb
                      ]}
                       onPress={() => selectCategoryForProduct(category)}
                    >
                       <View style={[styles.categorySelectorColorWeb, { backgroundColor: '#3B82F6' }]} />
                      <Text style={[
                        styles.categorySelectorTextWeb,
                         { color: '#3B82F6' },
                         newProduct.categoryId === category.id && styles.categorySelectorTextActiveWeb
                      ]}>
                         {category.categoryName}
                      </Text>
                </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              
               {/* Champ catégorie sélectionnée (lecture seule) */}
                <View style={styles.formGroupWeb}>
                 <Text style={styles.formLabelWeb}>Catégorie sélectionnée</Text>
                  <TextInput
                   style={[styles.formInputWeb, styles.readOnlyInputWeb]}
                   value={(categories as any[]).find((cat: any) => cat.id === newProduct.categoryId)?.categoryName || 'Aucune catégorie sélectionnée'}
                   placeholder="Sélectionnez une catégorie ci-dessus"
                    placeholderTextColor="#9CA3AF"
                   editable={false}
                  />
                </View>
                
                <View style={styles.formGroupWeb}>
                 <Text style={styles.formLabelWeb}>Nom du produit *</Text>
                  <TextInput
                    style={styles.formInputWeb}
                   value={newProduct.productName}
                   onChangeText={(text) => setNewProduct({...newProduct, productName: text})}
                   placeholder="Ex: Pizza Margherita"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                
              <View style={styles.formRowWeb}>
                <View style={styles.formGroupWeb}>
                   <Text style={styles.formLabelWeb}>Prix (USD) *</Text>
                  <TextInput
                    style={styles.formInputWeb}
                     value={newProduct.priceUsd}
                     onChangeText={(text) => setNewProduct({...newProduct, priceUsd: text})}
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
                
                <View style={styles.formGroupWeb}>
                   <Text style={styles.formLabelWeb}>Prix (CDF) *</Text>
                  <TextInput
                    style={styles.formInputWeb}
                     value={newProduct.priceCdf}
                     onChangeText={(text) => setNewProduct({...newProduct, priceCdf: text})}
                     placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                     keyboardType="numeric"
                  />
                </View>
                </View>
                
                <View style={styles.formGroupWeb}>
                  <Text style={styles.formLabelWeb}>Stock minimum</Text>
                  <TextInput
                    style={styles.formInputWeb}
                   value={newProduct.minimalStock}
                   onChangeText={(text) => setNewProduct({...newProduct, minimalStock: text})}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
                
              <View style={styles.formGroupWeb}>
                <Text style={styles.formLabelWeb}>Description</Text>
                  <TextInput
                  style={[styles.formInputWeb, styles.textAreaWeb]}
                    value={newProduct.description}
                    onChangeText={(text) => setNewProduct({...newProduct, description: text})}
                  placeholder="Description du produit..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                  />
                </View>
                
              <View style={styles.formActionsWeb}>
                {editingProduct && (
                  <TouchableOpacity 
                    style={styles.cancelButtonWeb} 
                    onPress={() => {
                      setEditingProduct(null);
                      setNewProduct({
                        productName: '',
                        categoryId: '',
                        description: '',
                        priceUsd: '',
                        priceCdf: '',
                        minimalStock: '',
                        imageBase64: 'UkVTVE9NQU5BR0VSQVBQ'
                      });
                    }}
                  >
                    <Text style={styles.cancelButtonTextWeb}>Annuler</Text>
                  </TouchableOpacity>
                )}
                    <TouchableOpacity
                   style={[styles.submitButtonWeb, apiLoading && styles.disabledButtonWeb]} 
                   onPress={handleSubmitProduct}
                   disabled={apiLoading}
                 >
                   {apiLoading ? (
                     <ActivityIndicator size="small" color="#FFFFFF" />
                   ) : (
                     <Text style={styles.submitButtonTextWeb}>
                       {editingProduct ? 'Modifier' : 'Créer'}
                     </Text>
                   )}
                    </TouchableOpacity>
                </View>
              </View>
              
            {/* Formulaire de gestion de stock */}
            {editingProduct && (
              <View style={styles.stockFormContainerWeb}>
                <Text style={styles.stockFormTitleWeb}>Gestion du stock</Text>

                {/* Affichage du stock actuel */}
                <View style={styles.currentStockInfoWeb}>
                  <View style={styles.currentStockItemWeb}>
                    <Text style={styles.currentStockLabelWeb}>Stock actuel</Text>
                    <Text style={styles.currentStockValueWeb}>
                      Source : 
                      {stockManagementTab === 'transfer'
                        ? sourceProductLoading
                          ? '...'
                          : sourceProductError
                          ? '—'
                          : sourceProductInfo
                          ? sourceProductInfo.inStock
                          : editingProduct.inStock || 0
                        : editingProduct.inStock || 0}
                    </Text>
                  </View>
                  <View style={styles.currentStockItemWeb}>
                    <Text style={styles.currentStockLabelWeb}>
                      {stockManagementTab === 'transfer'
                        ? destinationProductLoading
                          ? 'Stock destination (chargement...)'
                          : destinationProductError
                          ? 'Stock destination indisponible'
                          : destinationProductInfo
                          ? destinationProductInfo.productName
                          : transferDepotCode
                          ? 'Stock destination indisponible'
                          : 'Sélectionnez un dépôt de destination'
                        : 'Stock minimum'}
                    </Text>
                    <Text style={styles.currentStockValueWeb}>
                      Destination:
                      {stockManagementTab === 'transfer'
                        ? destinationProductLoading
                          ? '...'
                          : destinationProductError
                          ? '—'
                          : destinationProductInfo
                          ? destinationProductInfo.inStock
                          : '-'
                        : editingProduct.minimalStock || 0}
                    </Text>
                  </View>
                </View>
                {stockManagementTab === 'transfer' && sourceProductError ? (
                  <Text style={styles.stockErrorTextWeb}>{sourceProductError}</Text>
                ) : null}
                {stockManagementTab === 'transfer' && destinationProductError ? (
                  <Text style={styles.stockErrorTextWeb}>{destinationProductError}</Text>
                ) : null}

                <View style={styles.stockTabsWeb}>
                  <TouchableOpacity
                    style={[
                      styles.stockTabButtonWeb,
                      stockManagementTab === 'adjust' && styles.stockTabButtonActiveWeb
                    ]}
                    onPress={() => setStockManagementTab('adjust')}
                  >
                    <Text
                      style={[
                        styles.stockTabButtonTextWeb,
                        stockManagementTab === 'adjust' && styles.stockTabButtonTextActiveWeb
                      ]}
                    >
                      Ajuster le stock
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.stockTabButtonWeb,
                      stockManagementTab === 'transfer' && styles.stockTabButtonActiveWeb
                    ]}
                    onPress={() => setStockManagementTab('transfer')}
                  >
                    <Text
                      style={[
                        styles.stockTabButtonTextWeb,
                        stockManagementTab === 'transfer' && styles.stockTabButtonTextActiveWeb
                      ]}
                    >
                      Transférer le stock
                    </Text>
                  </TouchableOpacity>
                </View>

                {stockManagementTab === 'adjust' ? (
                  <>
                    <View style={styles.stockFormRowWeb}>
                      <View style={styles.stockFormGroupWeb}>
                        <Text style={styles.stockFormLabelWeb}>Quantité *</Text>
                        <TextInput
                          style={styles.stockFormInputWeb}
                          value={stockQuantity}
                          onChangeText={setStockQuantity}
                          placeholder="Entrez la quantité"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                        />
                      </View>

                      <View style={styles.stockFormGroupWeb}>
                        <Text style={styles.stockFormLabelWeb}>Observation</Text>
                        <TextInput
                          style={styles.stockFormInputWeb}
                          value={stockObservation}
                          onChangeText={setStockObservation}
                          placeholder="Observation (optionnel)"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    </View>

                    <View style={styles.stockFormGroupWeb}>
                      <Text style={styles.stockFormLabelWeb}>Date d'expiration *</Text>
                      <TextInput
                        style={[styles.stockFormInputWeb,{marginBottom: 10}]}
                        value={adjustExpirationDate}
                        onChangeText={setAdjustExpirationDate}
                        placeholder="Sélectionnez une date"
                        placeholderTextColor="#9CA3AF"
                        onFocus={(event) => {
                          if (Platform.OS === 'web') {
                            const target = event?.target as unknown as HTMLInputElement | undefined;
                            if (target) {
                              target.type = 'datetime-local';
                            }
                          }
                        }}
                        onBlur={(event) => {
                          if (Platform.OS === 'web') {
                            const target = event?.target as unknown as HTMLInputElement | undefined;
                            if (target) {
                              target.type = 'text';
                            }
                          }
                        }}
                      />
                    </View>

                    <View style={styles.stockFormActionsWeb}>
                      <TouchableOpacity 
                        style={[styles.stockAddButtonWeb, stockLoading && styles.disabledButtonWeb]} 
                        onPress={() => confirmStockAction('add')}
                        disabled={stockLoading}
                      >
                        {stockLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="add" size={20} color="#FFFFFF" />
                        )}
                        <Text style={styles.stockButtonTextWeb}>Ajouter au stock</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.stockRemoveButtonWeb, 
                          (stockLoading || (editingProduct.inStock || 0) === 0) && styles.disabledButtonWeb
                        ]} 
                        onPress={() => confirmStockAction('remove')}
                        disabled={stockLoading || (editingProduct.inStock || 0) === 0}
                      >
                        {stockLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="remove" size={20} color="#FFFFFF" />
                        )}
                        <Text style={styles.stockButtonTextWeb}>
                          {(editingProduct.inStock || 0) === 0 ? 'Stock vide' : 'Retirer du stock'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {stockFeedback && (
                      <Text
                        style={[
                          styles.stockFeedbackTextWeb,
                          stockFeedback.type === 'error'
                            ? styles.stockFeedbackErrorWeb
                            : styles.stockFeedbackSuccessWeb
                        ]}
                      >
                        {stockFeedback.message}
                      </Text>
                    )}
                  </>
                ) : (
                  <View style={styles.transferFormWeb}>
                    <View style={styles.transferDepotSectionWeb}>
                      {isAdmin ? (
                        <>
                          <Text style={styles.stockFormLabelWeb}>Dépôt source *</Text>
                          {depotCodesLoading ? (
                            <View style={styles.depotLoadingContainerWeb}>
                              <ActivityIndicator size="small" color="#3B82F6" />
                              <Text style={styles.depotLoadingTextWeb}>Chargement des dépôts...</Text>
                            </View>
                          ) : depotOptions.length > 0 ? (
                            <View style={styles.depotChipsContainerWeb}>
                              {depotOptions.map((code) => (
                                <TouchableOpacity
                                  key={code}
                                  style={[
                                    styles.depotChipWeb,
                                    transferSourceDepotCode === code && styles.depotChipActiveWeb
                                  ]}
                                  onPress={() => setTransferSourceDepotCode(code)}
                                >
                                  <Text
                                    style={[
                                      styles.depotChipTextWeb,
                                      transferSourceDepotCode === code && styles.depotChipTextActiveWeb
                                    ]}
                                  >
                                    {code}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.stockHelperTextWeb}>
                              Aucun dépôt disponible pour le transfert.
                            </Text>
                          )}
                        </>
                      ) : (
                        <>
                          <Text style={styles.stockFormLabelWeb}>Dépôt source</Text>
                          <Text style={styles.stockHelperTextWeb}>
                            {userDepotCode
                              ? `Le transfert partira du dépôt ${userDepotCode}.`
                              : 'Code dépôt de l’utilisateur introuvable.'}
                          </Text>
                        </>
                      )}
                    </View>
                    <View style={styles.transferDepotSectionWeb}>
                      <Text style={styles.stockFormLabelWeb}>Dépôt de destination *</Text>
                      {depotCodesLoading ? (
                        <View style={styles.depotLoadingContainerWeb}>
                          <ActivityIndicator size="small" color="#3B82F6" />
                          <Text style={styles.depotLoadingTextWeb}>Chargement des dépôts...</Text>
                        </View>
                      ) : destinationDepotCodes.length > 0 ? (
                        <View style={styles.depotChipsContainerWeb}>
                          {destinationDepotCodes.map((code) => (
                            <TouchableOpacity
                              key={code}
                              style={[
                                styles.depotChipWeb,
                                transferDepotCode === code && styles.depotChipActiveWeb
                              ]}
                              onPress={() => setTransferDepotCode(code)}
                            >
                              <Text
                                style={[
                                  styles.depotChipTextWeb,
                                  transferDepotCode === code && styles.depotChipTextActiveWeb
                                ]}
                              >
                                {code}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.stockHelperTextWeb}>
                          Aucun dépôt disponible pour le transfert.
                        </Text>
                      )}
                      {depotCodesError && (
                        <Text style={styles.stockErrorTextWeb}>{depotCodesError}</Text>
                      )}
                    </View>

                    <View style={styles.stockFormRowWeb}>
                      <View style={styles.stockFormGroupWeb}>
                        <Text style={styles.stockFormLabelWeb}>Quantité *</Text>
                        <TextInput
                          style={styles.stockFormInputWeb}
                          value={transferQuantity}
                          onChangeText={setTransferQuantity}
                          placeholder="Entrez la quantité"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="numeric"
                        />
                      </View>

                      <View style={styles.stockFormGroupWeb}>
                        <Text style={styles.stockFormLabelWeb}>Observation</Text>
                        <TextInput
                          style={styles.stockFormInputWeb}
                          value={transferObservation}
                          onChangeText={setTransferObservation}
                          placeholder="Observation (optionnel)"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    </View>

                    <View style={styles.stockFormActionsWeb}>
                      <TouchableOpacity
                        style={[
                          styles.stockTransferButtonWeb, 
                          (transferLoading || destinationDepotCodes.length === 0) && styles.disabledButtonWeb
                        ]}
                        onPress={confirmTransferStock}
                        disabled={transferLoading || destinationDepotCodes.length === 0}
                      >
                        {transferLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="repeat-outline" size={20} color="#FFFFFF" />
                        )}
                        <Text style={styles.stockButtonTextWeb}>Transférer</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
        </View>
      )}
        </ScrollView>
        {historyModal}
      </>
    );
  }

  // Version Mobile - Modern Design
  return (
    <>
    <ScrollView style={styles.containerMobile}>
      {/* Tabs Navigation Mobile */}
      <View style={styles.tabsContainerMobile}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollMobile}>
          {inventoryTabsConfig.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabButtonMobile, activeTab === tab.key && styles.tabButtonMobileActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={18}
                color={activeTab === tab.key ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                style={[styles.tabButtonTextMobile, activeTab === tab.key && styles.tabButtonTextMobileActive]}
              >
                {tab.mobileLabel}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Contenu des onglets */}
      {activeTab === 'products' && (
        <View style={styles.tabContentMobile}>
          {/* Loading et Erreurs */}
          {(categoriesLoading || productsLoading) && (
            <View style={styles.loadingContainerMobile}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.loadingTextMobile}>Chargement...</Text>
            </View>
          )}

          {(categoriesError || productsError) && (
            <View style={styles.errorContainerMobile}>
              <Ionicons name="alert-circle" size={32} color="#EF4444" />
              <Text style={styles.errorTextMobile}>{categoriesError || productsError}</Text>
              <TouchableOpacity style={styles.retryButtonMobile} onPress={() => {
                refetchCategories();
                refetchProducts();
              }}>
                <Text style={styles.retryButtonTextMobile}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {!categoriesLoading && !productsLoading && !categoriesError && !productsError && (
            <>
              {/* Barre de recherche */}
              <View style={styles.searchContainerMobile}>
                <View style={styles.searchBarMobile}>
                  <Ionicons name="search" size={18} color="#6B7280" />
                  <TextInput 
                    placeholder="Rechercher..." 
                    style={styles.searchInputMobile}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <TouchableOpacity 
                  style={styles.refreshButtonMobile}
                  onPress={() => {
                    refetchCategories();
                    refetchProducts();
                  }}
                >
                  <Ionicons name="refresh" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Filtres par catégorie */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFiltersMobile}>
                <TouchableOpacity
                  style={[styles.categoryFilterMobile, selectedCategory === 'Toutes' && styles.categoryFilterActiveMobile]}
                  onPress={() => setSelectedCategory('Toutes')}
                >
                  <Text style={[styles.categoryFilterTextMobile, selectedCategory === 'Toutes' && styles.categoryFilterTextActiveMobile]}>
                    Toutes
                  </Text>
                </TouchableOpacity>
                {categories.map((category: any) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryFilterMobile, selectedCategory === category.categoryName && styles.categoryFilterActiveMobile]}
                    onPress={() => setSelectedCategory(category.categoryName)}
                  >
                    <Text style={[styles.categoryFilterTextMobile, selectedCategory === category.categoryName && styles.categoryFilterTextActiveMobile]}>
                      {category.categoryName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Liste des produits */}
              <View style={styles.productsListMobile}>
                {products
                  .filter((product: any) => {
                    const matchesSearch = searchQuery === '' || 
                      product.productName.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesCategory = selectedCategory === 'Toutes' || 
                      product.category?.categoryName === selectedCategory;
                    return matchesSearch && matchesCategory;
                  })
                  .map((product: any) => (
                    <View key={product.id} style={styles.productCardMobile}>
                      <View style={styles.productHeaderMobile}>
                        <View style={styles.productIconMobile}>
                          <Ionicons name="cube" size={20} color="#7C3AED" />
                        </View>
                        <View style={styles.productInfoMobile}>
                          <Text style={styles.productNameMobile}>{product.productName}</Text>
                          <Text style={styles.productCategoryMobile}>{product.category?.categoryName || 'N/A'}</Text>
                        </View>
                        <View style={styles.productHeaderActionsMobile}>
                          <TouchableOpacity
                            style={styles.historyIconMobile}
                            onPress={() => openHistoryModal(product)}
                          >
                            <Ionicons name="time-outline" size={22} color="#2563EB" />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.editIconMobile}
                            onPress={() => selectProductForEdit(product)}
                          >
                            <Ionicons name="create" size={24} color="#3B82F6" />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.productDetailsMobile}>
                        <View style={styles.priceRowMobile}>
                          <Text style={styles.priceLabelMobile}>Prix USD:</Text>
                          <Text style={styles.priceValueMobile}>${product.priceUsd}</Text>
                        </View>
                        <View style={styles.priceRowMobile}>
                          <Text style={styles.priceLabelMobile}>Prix CDF:</Text>
                          <Text style={styles.priceValueMobile}>{product.priceCdf} CDF</Text>
                        </View>
                        <View style={styles.stockRowMobile}>
                          <Text style={styles.stockLabelMobile}>Stock:</Text>
                          <Text style={[
                            styles.stockValueMobile,
                            (product.inStock || 0) === 0 && styles.stockEmptyMobile,
                            (product.inStock || 0) <= (product.minimalStock || 5) && (product.inStock || 0) > 0 && styles.stockLowMobile
                          ]}>
                            {product.inStock || 0} unités
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                {products.filter((product: any) => {
                  const matchesSearch = searchQuery === '' || 
                    product.productName.toLowerCase().includes(searchQuery.toLowerCase());
                  const matchesCategory = selectedCategory === 'Toutes' || 
                    product.category?.categoryName === selectedCategory;
                  return matchesSearch && matchesCategory;
                }).length === 0 && (
                  <View style={styles.emptyStateMobile}>
                    <Ionicons name="cube-outline" size={48} color="#9CA3AF" />
                    <Text style={styles.emptyTextMobile}>Aucun produit trouvé</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      )}

      {activeTab === 'categories' && (
        <View style={styles.tabContentMobile}>
          {categoriesLoading && (
            <View style={styles.loadingContainerMobile}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.loadingTextMobile}>Chargement...</Text>
            </View>
          )}

          {!categoriesLoading && (
            <>
              {/* Formulaire de catégorie */}
              <View style={styles.formContainerMobile}>
                <Text style={styles.formTitleMobile}>
                  {editingCategory ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
                </Text>
                <View style={styles.formFieldMobile}>
                  <Text style={styles.formLabelMobile}>Nom *</Text>
                  <TextInput
                    style={styles.formInputMobile}
                    placeholder="Nom de la catégorie"
                    placeholderTextColor="#9CA3AF"
                    value={newCategory.categoryName}
                    onChangeText={(text) => setNewCategory({...newCategory, categoryName: text})}
                  />
                </View>
                <View style={styles.formFieldMobile}>
                  <Text style={styles.formLabelMobile}>Description</Text>
                  <TextInput
                    style={[styles.formInputMobile, styles.textAreaMobile]}
                    placeholder="Description (optionnel)"
                    placeholderTextColor="#9CA3AF"
                    value={newCategory.description}
                    onChangeText={(text) => setNewCategory({...newCategory, description: text})}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                <View style={styles.formActionsMobile}>
                  {editingCategory ? (
                    <>
                      <TouchableOpacity 
                        style={[styles.saveButtonMobile, apiLoading && styles.disabledButtonMobile]} 
                        onPress={handleUpdateCategory}
                        disabled={apiLoading}
                      >
                        {apiLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                        )}
                        <Text style={styles.buttonTextMobile}>Mettre à jour</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelButtonMobile} onPress={() => {
                        setEditingCategory(null);
                        setNewCategory({ categoryName: '', description: '' });
                      }}>
                        <Text style={styles.cancelButtonTextMobile}>Annuler</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity 
                      style={[styles.createButtonMobile, apiLoading && styles.disabledButtonMobile]} 
                      onPress={handleCreateCategory}
                      disabled={apiLoading}
                    >
                      {apiLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                      )}
                      <Text style={styles.buttonTextMobile}>Créer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Liste des catégories */}
              <View style={styles.categoriesListMobile}>
                <Text style={styles.listTitleMobile}>Catégories ({categories.length})</Text>
                {categories.map((category: any) => (
                  <View key={category.id} style={styles.categoryCardMobile}>
                    <View style={styles.categoryInfoMobile}>
                      <Text style={styles.categoryNameMobile}>{category.categoryName}</Text>
                      <Text style={styles.categoryDescMobile}>{category.description || 'Pas de description'}</Text>
                    </View>
                    <View style={styles.categoryActionsMobile}>
                      <TouchableOpacity onPress={() => editCategory(category)} style={styles.editButtonMobile}>
                        <Ionicons name="create" size={18} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteCategory(category)} style={styles.deleteButtonMobile}>
                        <Ionicons name="trash" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {activeTab === 'product-management' && (
        <View style={styles.tabContentMobile}>
          {/* Formulaire de produit */}
          <View style={styles.formContainerMobile}>
            <Text style={styles.formTitleMobile}>
              {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
            </Text>
            
            <View style={styles.formFieldMobile}>
              <Text style={styles.formLabelMobile}>Nom du produit *</Text>
              <TextInput
                style={styles.formInputMobile}
                placeholder="Nom"
                placeholderTextColor="#9CA3AF"
                value={newProduct.productName}
                onChangeText={(text) => setNewProduct({...newProduct, productName: text})}
              />
            </View>

            <View style={styles.formFieldMobile}>
              <Text style={styles.formLabelMobile}>Catégorie *</Text>
              <View style={styles.pickerWrapperMobile}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {categories.map((category: any) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryPickerMobile,
                        newProduct.categoryId === category.id && styles.categoryPickerActiveMobile
                      ]}
                      onPress={() => setNewProduct({...newProduct, categoryId: category.id})}
                    >
                      <Text style={[
                        styles.categoryPickerTextMobile,
                        newProduct.categoryId === category.id && styles.categoryPickerTextActiveMobile
                      ]}>
                        {category.categoryName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.formFieldMobile}>
              <Text style={styles.formLabelMobile}>Description</Text>
              <TextInput
                style={[styles.formInputMobile, styles.textAreaMobile]}
                placeholder="Description du produit"
                placeholderTextColor="#9CA3AF"
                value={newProduct.description}
                onChangeText={(text) => setNewProduct({...newProduct, description: text})}
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.priceGridMobile}>
              <View style={[styles.formFieldMobile, { flex: 1 }]}>
                <Text style={styles.formLabelMobile}>Prix USD *</Text>
                <TextInput
                  style={styles.formInputMobile}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={newProduct.priceUsd}
                  onChangeText={(text) => setNewProduct({...newProduct, priceUsd: text})}
                />
              </View>
              <View style={[styles.formFieldMobile, { flex: 1 }]}>
                <Text style={styles.formLabelMobile}>Prix CDF *</Text>
                <TextInput
                  style={styles.formInputMobile}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={newProduct.priceCdf}
                  onChangeText={(text) => setNewProduct({...newProduct, priceCdf: text})}
                />
              </View>
            </View>

            <View style={styles.formFieldMobile}>
              <Text style={styles.formLabelMobile}>Stock minimal</Text>
              <TextInput
                style={styles.formInputMobile}
                placeholder="5"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={newProduct.minimalStock}
                onChangeText={(text) => setNewProduct({...newProduct, minimalStock: text})}
              />
            </View>

            <View style={styles.formActionsMobile}>
              {editingProduct ? (
                <>
                  <TouchableOpacity 
                    style={[styles.saveButtonMobile, apiLoading && styles.disabledButtonMobile]} 
                    onPress={handleUpdateProduct}
                    disabled={apiLoading}
                  >
                    {apiLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    )}
                    <Text style={styles.buttonTextMobile}>Mettre à jour</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelButtonMobile} onPress={() => {
                    setEditingProduct(null);
                    setNewProduct({
                      productName: '',
                      categoryId: '',
                      description: '',
                      priceUsd: '',
                      priceCdf: '',
                      minimalStock: '',
                      imageBase64: 'UkVTVE9NQU5BR0VSQVBQ'
                    });
                  }}>
                    <Text style={styles.cancelButtonTextMobile}>Annuler</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  style={[styles.createButtonMobile, apiLoading && styles.disabledButtonMobile]} 
                  onPress={handleCreateProduct}
                  disabled={apiLoading}
                >
                  {apiLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  )}
                  <Text style={styles.buttonTextMobile}>Créer le produit</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Section Gestion du stock (si en mode édition) */}
            {editingProduct && (
              <View style={styles.stockSectionMobile}>
                <Text style={styles.stockTitleMobile}>Gestion du stock</Text>
                <View style={styles.currentStockMobile}>
                  <Text style={styles.currentStockLabelMobile}>Stock actuel:</Text>
                  <Text style={styles.currentStockValueMobile}>
                    {stockManagementTab === 'transfer'
                      ? sourceProductLoading
                        ? '...'
                        : sourceProductError
                        ? '—'
                        : sourceProductInfo
                        ? `${sourceProductInfo.inStock} unités`
                        : `${editingProduct.inStock || 0} unités`
                      : `${editingProduct.inStock || 0} unités`}
                  </Text>
                </View>
                {stockManagementTab === 'transfer' ? (
                  <View style={styles.destinationStockMobile}>
                    <Text style={styles.destinationStockLabelMobile}>
                      {destinationProductLoading
                        ? 'Stock destination (chargement...)'
                        : destinationProductError
                        ? 'Stock destination indisponible'
                        : destinationProductInfo
                        ? destinationProductInfo.productName
                        : transferDepotCode
                        ? 'Stock destination indisponible'
                        : 'Sélectionnez un dépôt de destination'}
                    </Text>
                    <Text style={styles.destinationStockValueMobile}>
                      {destinationProductLoading
                        ? '...'
                        : destinationProductError
                        ? '—'
                        : destinationProductInfo
                        ? `${destinationProductInfo.inStock} unités`
                        : '-'}
                    </Text>
                    {destinationProductError ? (
                      <Text style={styles.destinationStockErrorMobile}>{destinationProductError}</Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.destinationStockMobile}>
                    <Text style={styles.destinationStockLabelMobile}>Stock minimum</Text>
                    <Text style={styles.destinationStockValueMobile}>
                      {editingProduct.minimalStock || 0} unités
                    </Text>
                  </View>
                )}
                {stockManagementTab === 'transfer' && sourceProductError ? (
                  <Text style={styles.destinationStockErrorMobile}>{sourceProductError}</Text>
                ) : null}

                <View style={styles.stockToggleContainerMobile}>
                  <TouchableOpacity
                    style={[
                      styles.stockToggleButtonMobile,
                      stockManagementTab === 'adjust' && styles.stockToggleButtonActiveMobile
                    ]}
                    onPress={() => setStockManagementTab('adjust')}
                  >
                    <Text
                      style={[
                        styles.stockToggleTextMobile,
                        stockManagementTab === 'adjust' && styles.stockToggleTextActiveMobile
                      ]}
                    >
                      Ajuster
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.stockToggleButtonMobile,
                      stockManagementTab === 'transfer' && styles.stockToggleButtonActiveMobile
                    ]}
                    onPress={() => setStockManagementTab('transfer')}
                  >
                    <Text
                      style={[
                        styles.stockToggleTextMobile,
                        stockManagementTab === 'transfer' && styles.stockToggleTextActiveMobile
                      ]}
                    >
                      Transférer
                    </Text>
                  </TouchableOpacity>
                </View>

                {stockManagementTab === 'adjust' ? (
                  <>
                    <View style={styles.formFieldMobile}>
                      <Text style={styles.formLabelMobile}>Quantité *</Text>
                      <TextInput
                        style={styles.formInputMobile}
                        placeholder="Ex: 10"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={stockQuantity}
                        onChangeText={setStockQuantity}
                      />
                    </View>

                    <View style={styles.formFieldMobile}>
                      <Text style={styles.formLabelMobile}>Observation</Text>
                      <TextInput
                        style={[styles.formInputMobile, styles.textAreaMobile]}
                        placeholder="Raison..."
                        placeholderTextColor="#9CA3AF"
                        value={stockObservation}
                        onChangeText={setStockObservation}
                        multiline
                        numberOfLines={2}
                      />
                    </View>

                    <View style={styles.formFieldMobile}>
                      <Text style={styles.formLabelMobile}>Date d'expiration *</Text>
                      <TextInput
                        style={styles.formInputMobile}
                        placeholder="2025-11-13T12:42"
                        placeholderTextColor="#9CA3AF"
                        value={adjustExpirationDate}
                        onChangeText={setAdjustExpirationDate}
                        onFocus={(event: any) => {
                          if (Platform.OS === 'web') {
                            const target = event?.target as HTMLInputElement | undefined;
                            if (target) {
                              target.type = 'datetime-local';
                            }
                          }
                        }}
                        onBlur={(event: any) => {
                          if (Platform.OS === 'web') {
                            const target = event?.target as HTMLInputElement | undefined;
                            if (target) {
                              target.type = 'text';
                            }
                          }
                        }}
                      />
                    </View>

                    <View style={styles.stockActionsMobile}>
                      <TouchableOpacity 
                        style={styles.stockAddButtonMobile} 
                        onPress={() => confirmStockAction('add')}
                        disabled={stockLoading}
                      >
                        {stockLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                            <Text style={styles.buttonTextMobile}>Ajouter</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.stockRemoveButtonMobile, (editingProduct.inStock || 0) === 0 && styles.disabledButtonMobile]} 
                        onPress={() => confirmStockAction('remove')}
                        disabled={stockLoading || (editingProduct.inStock || 0) === 0}
                      >
                        {stockLoading ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="remove-circle" size={20} color="#FFFFFF" />
                            <Text style={styles.buttonTextMobile}>
                              {(editingProduct.inStock || 0) === 0 ? 'Stock vide' : 'Retirer'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                    {stockFeedback && (
                      <Text
                        style={[
                          styles.stockFeedbackTextMobile,
                          stockFeedback.type === 'error'
                            ? styles.stockFeedbackErrorMobile
                            : styles.stockFeedbackSuccessMobile
                        ]}
                      >
                        {stockFeedback.message}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                  <View style={styles.formFieldMobile}>
                    {isAdmin ? (
                      <>
                        <Text style={styles.formLabelMobile}>Dépôt source *</Text>
                        {depotCodesLoading ? (
                          <View style={styles.depotLoadingContainerMobile}>
                            <ActivityIndicator size="small" color="#3B82F6" />
                            <Text style={styles.depotLoadingTextMobile}>Chargement...</Text>
                          </View>
                        ) : depotOptions.length > 0 ? (
                          <View style={styles.depotChipsContainerMobile}>
                            {depotOptions.map((code) => (
                              <TouchableOpacity
                                key={code}
                                style={[
                                  styles.depotChipMobile,
                                  transferSourceDepotCode === code && styles.depotChipActiveMobile
                                ]}
                                onPress={() => setTransferSourceDepotCode(code)}
                              >
                                <Text
                                  style={[
                                    styles.depotChipTextMobile,
                                    transferSourceDepotCode === code && styles.depotChipTextActiveMobile
                                  ]}
                                >
                                  {code}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.stockInfoTextMobile}>Aucun dépôt disponible.</Text>
                        )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.formLabelMobile}>Dépôt source</Text>
                        <Text style={styles.stockInfoTextMobile}>
                          {userDepotCode
                            ? `Le transfert partira du dépôt ${userDepotCode}.`
                            : 'Code dépôt de l’utilisateur introuvable.'}
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={styles.formFieldMobile}>
                    <Text style={styles.formLabelMobile}>Dépôt de destination *</Text>
                    {depotCodesLoading ? (
                      <View style={styles.depotLoadingContainerMobile}>
                        <ActivityIndicator size="small" color="#3B82F6" />
                        <Text style={styles.depotLoadingTextMobile}>Chargement...</Text>
                      </View>
                    ) : destinationDepotCodes.length > 0 ? (
                      <View style={styles.depotChipsContainerMobile}>
                        {destinationDepotCodes.map((code) => (
                          <TouchableOpacity
                            key={code}
                            style={[
                              styles.depotChipMobile,
                              transferDepotCode === code && styles.depotChipActiveMobile
                            ]}
                            onPress={() => setTransferDepotCode(code)}
                          >
                            <Text
                              style={[
                                styles.depotChipTextMobile,
                                transferDepotCode === code && styles.depotChipTextActiveMobile
                              ]}
                            >
                              {code}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.stockInfoTextMobile}>Aucun dépôt disponible.</Text>
                    )}
                    {depotCodesError && (
                      <Text style={styles.stockErrorTextMobile}>{depotCodesError}</Text>
                    )}
                  </View>

                    <View style={styles.formFieldMobile}>
                      <Text style={styles.formLabelMobile}>Quantité *</Text>
                      <TextInput
                        style={styles.formInputMobile}
                        placeholder="Ex: 5"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={transferQuantity}
                        onChangeText={setTransferQuantity}
                      />
                    </View>

                    <View style={styles.formFieldMobile}>
                      <Text style={styles.formLabelMobile}>Observation</Text>
                      <TextInput
                        style={[styles.formInputMobile, styles.textAreaMobile]}
                        placeholder="Note (optionnel)"
                        placeholderTextColor="#9CA3AF"
                        value={transferObservation}
                        onChangeText={setTransferObservation}
                        multiline
                        numberOfLines={2}
                      />
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.stockTransferButtonMobile,
                        (transferLoading || destinationDepotCodes.length === 0) && styles.disabledButtonMobile
                      ]}
                      onPress={confirmTransferStock}
                      disabled={transferLoading || destinationDepotCodes.length === 0}
                    >
                      {transferLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="repeat-outline" size={20} color="#FFFFFF" />
                          <Text style={styles.buttonTextMobile}>Transférer</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
    {historyModal}
    </>
  );
};

const styles = StyleSheet.create({
  // Styles Web
  containerWeb: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  titleWeb: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 24,
  },
  tabsPillContainerWeb: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 6,
    gap: 8,
    alignSelf: 'flex-start',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonWeb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tabButtonWebActive: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  tabButtonTextWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabButtonTextWebActive: {
    color: '#FFFFFF',
  },
  searchContainerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  searchBarWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInputWeb: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  refreshButtonWeb: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryFiltersWeb: {
    marginBottom: 16,
  },
  categoryFilterWeb: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  categoryFilterActiveWeb: {
    backgroundColor: '#3B82F6',
  },
  categoryFilterTextWeb: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryFilterTextActiveWeb: {
    color: '#FFFFFF',
  },
  tableContainerWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tableHeaderWeb: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tableHeaderTextWeb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  tableRowWeb: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    alignItems: 'center',
  },
  productCellWeb: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productIconWeb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  productNameWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  productUnitWeb: {
    fontSize: 12,
    color: '#6B7280',
  },
  categoryCellWeb: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  priceCellWeb: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  stockCellWeb: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  statusCellWeb: {
    flex: 1,
  },
  statusBadgeWeb: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusTextWeb: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  actionsCellWeb: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonWeb: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  historyButtonWeb: {
    backgroundColor: '#DBEAFE',
  },
  formContainerWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitleWeb: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 24,
  },
  formRowWeb: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  formGroupWeb: {
    flex: 1,
    marginBottom: 16,
  },
  formLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  formInputWeb: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  textAreaWeb: {
    height: 80,
    textAlignVertical: 'top',
  },
  colorPickerWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOptionWeb: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelectedWeb: {
    borderColor: '#1F2937',
  },
  formActionsWeb: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelButtonWeb: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  submitButtonWeb: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
  },
  submitButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  categoryNameWeb: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  categoryDescriptionWeb: {
    flex: 2,
    fontSize: 14,
    color: '#6B7280',
  },
  colorCellWeb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorPreviewWeb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  colorTextWeb: {
    fontSize: 12,
    color: '#6B7280',
  },
  stockManagementWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stockTitleWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  stockInfoWeb: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
  },
  stockItemWeb: {
    flex: 1,
  },
  stockLabelWeb: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  stockValueWeb: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  stockActionsWeb: {
    flexDirection: 'row',
    gap: 12,
  },
  stockButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10B981',
    gap: 8,
  },
  stockButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  readOnlyInputWeb: {
    backgroundColor: '#F9FAFB',
    color: '#6B7280',
    borderColor: '#E5E7EB',
  },
  readOnlyLabelWeb: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  increaseButtonWeb: {
    backgroundColor: '#10B981',
  },
  decreaseButtonWeb: {
    backgroundColor: '#EF4444',
  },
  categorySelectorContainerWeb: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categorySelectorLabelWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  categorySelectorWeb: {
    flexDirection: 'row',
  },
  categorySelectorItemWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: '#F9FAFB',
  },
  categorySelectorItemActiveWeb: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categorySelectorColorWeb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categorySelectorTextWeb: {
    fontSize: 14,
    fontWeight: '500',
  },
  categorySelectorTextActiveWeb: {
    color: '#FFFFFF',
  },
  // Styles Mobile
  containerMobile: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabsContainerMobile: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  tabsScrollMobile: {
    paddingHorizontal: 10,
    gap: 8,
  },
  tabButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  tabButtonMobileActive: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 2,
  },
  tabButtonTextMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabButtonTextMobileActive: {
    color: '#FFFFFF',
  },
  tabContentMobile: {
    flex: 1,
    padding: 16,
  },
  searchContainerMobile: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  searchBarMobile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInputMobile: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  refreshButtonMobile: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryFiltersMobile: {
    marginBottom: 16,
  },
  categoryFilterMobile: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryFilterActiveMobile: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  categoryFilterTextMobile: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryFilterTextActiveMobile: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  productsListMobile: {
    gap: 12,
  },
  productCardMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  productHeaderMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  productIconMobile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfoMobile: {
    flex: 1,
  },
  productNameMobile: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  productCategoryMobile: {
    fontSize: 12,
    color: '#6B7280',
  },
  productHeaderActionsMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyIconMobile: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#DBEAFE',
  },
  editIconMobile: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  productDetailsMobile: {
    gap: 8,
  },
  priceRowMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabelMobile: {
    fontSize: 13,
    color: '#6B7280',
  },
  priceValueMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  stockRowMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  stockLabelMobile: {
    fontSize: 13,
    color: '#6B7280',
  },
  stockValueMobile: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  stockEmptyMobile: {
    color: '#EF4444',
  },
  stockLowMobile: {
    color: '#F59E0B',
  },
  loadingContainerMobile: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  loadingTextMobile: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainerMobile: {
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorTextMobile: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButtonMobile: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonTextMobile: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateMobile: {
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTextMobile: {
    fontSize: 14,
    color: '#6B7280',
  },
  formContainerMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  formTitleMobile: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  formFieldMobile: {
    marginBottom: 12,
  },
  formLabelMobile: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  formInputMobile: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
  },
  textAreaMobile: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  priceGridMobile: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerWrapperMobile: {
    marginTop: 4,
  },
  categoryPickerMobile: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryPickerActiveMobile: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  categoryPickerTextMobile: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryPickerTextActiveMobile: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  formActionsMobile: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  saveButtonMobile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  createButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  cancelButtonMobile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonTextMobile: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButtonTextMobile: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  categoriesListMobile: {
    gap: 8,
  },
  listTitleMobile: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  categoryCardMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryInfoMobile: {
    flex: 1,
  },
  categoryNameMobile: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  categoryDescMobile: {
    fontSize: 12,
    color: '#6B7280',
  },
  categoryActionsMobile: {
    flexDirection: 'row',
    gap: 8,
  },
  editButtonMobile: {
    padding: 6,
  },
  deleteButtonMobile: {
    padding: 6,
  },
  stockSectionMobile: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  stockTitleMobile: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  currentStockMobile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  currentStockLabelMobile: {
    fontSize: 14,
    color: '#6B7280',
  },
  currentStockValueMobile: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  destinationStockMobile: {
    marginTop: 12,
  },
  destinationStockLabelMobile: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  destinationStockValueMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  destinationStockErrorMobile: {
    marginTop: 4,
    fontSize: 12,
    color: '#DC2626',
  },
  stockToggleContainerMobile: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 4,
    marginBottom: 16,
  },
  stockToggleButtonMobile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  stockToggleButtonActiveMobile: {
    backgroundColor: '#7C3AED',
  },
  stockToggleTextMobile: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  stockToggleTextActiveMobile: {
    color: '#FFFFFF',
  },
  stockActionsMobile: {
    flexDirection: 'row',
    gap: 8,
  },
  stockAddButtonMobile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  stockRemoveButtonMobile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  stockTransferButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 12,
  },
  depotLoadingContainerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  depotLoadingTextMobile: {
    fontSize: 13,
    color: '#6B7280',
  },
  depotChipsContainerMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  depotChipMobile: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  depotChipActiveMobile: {
    backgroundColor: '#7C3AED',
  },
  depotChipTextMobile: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  depotChipTextActiveMobile: {
    color: '#FFFFFF',
  },
  stockInfoTextMobile: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  stockErrorTextMobile: {
    marginTop: 8,
    fontSize: 13,
    color: '#DC2626',
  },
  stockFeedbackTextMobile: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  stockFeedbackErrorMobile: {
    color: '#DC2626',
  },
  stockFeedbackSuccessMobile: {
    color: '#10B981',
  },
  disabledButtonMobile: {
    opacity: 0.5,
  },
  // Styles pour les états de chargement et erreurs
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
  disabledButtonWeb: {
    opacity: 0.6,
  },
  deleteButtonWeb: {
    marginLeft: 8,
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
  // Styles pour le formulaire de stock
  stockFormContainerWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  stockFormTitleWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
  },
  stockTabsWeb: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    marginBottom: 20,
  },
  stockTabButtonWeb: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  stockTabButtonActiveWeb: {
    backgroundColor: '#2563EB',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  stockTabButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  stockTabButtonTextActiveWeb: {
    color: '#FFFFFF',
  },
  stockFormRowWeb: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  stockFormGroupWeb: {
    flex: 1,
  },
  stockFormLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  stockFormInputWeb: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  stockFormActionsWeb: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  transferFormWeb: {
    gap: 20,
  },
  transferDepotSectionWeb: {
    gap: 12,
  },
  stockAddButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10B981',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  stockRemoveButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  stockTransferButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  depotLoadingContainerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  depotLoadingTextWeb: {
    fontSize: 13,
    color: '#4B5563',
  },
  depotChipsContainerWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  depotChipWeb: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  depotChipActiveWeb: {
    backgroundColor: '#2563EB',
  },
  depotChipTextWeb: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  depotChipTextActiveWeb: {
    color: '#FFFFFF',
  },
  stockHelperTextWeb: {
    fontSize: 13,
    color: '#6B7280',
  },
  stockErrorTextWeb: {
    fontSize: 13,
    color: '#DC2626',
  },
  stockFeedbackTextWeb: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  stockFeedbackErrorWeb: {
    color: '#DC2626',
  },
  stockFeedbackSuccessWeb: {
    color: '#16A34A',
  },
  historyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  historyModalContent: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  historyModalContentWeb: {
    maxWidth: 760,
  },
  historyModalContentMobile: {
    maxWidth: '100%',
  },
  historyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  historyModalTitleBlock: {
    flex: 1,
  },
  historyModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  historyModalSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  historyDepotInfo: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
  },
  historyModalCloseButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  historyModalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flex: 1,
  },
  historyDepotSelector: {
    marginBottom: 16,
  },
  historyDepotLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  historyDepotValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  historyDepotChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyDepotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  historyDepotChipActive: {
    backgroundColor: '#2563EB',
  },
  historyDepotChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
  },
  historyDepotChipTextActive: {
    color: '#FFFFFF',
  },
  historyTabs: {
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    padding: 4,
    marginBottom: 16,
  },
  historyTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
  },
  historyTabButtonActive: {
    backgroundColor: '#2563EB',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  historyTabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  historyTabButtonTextActive: {
    color: '#FFFFFF',
  },
  historySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historySummaryText: {
    fontSize: 13,
    color: '#6B7280',
  },
  historySummaryCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  historyModalScroll: {
    flex: 1,
  },
  historyListContent: {
    paddingBottom: 24,
  },
  historyLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  historyErrorText: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
  },
  historyEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  historyEmptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  historyCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyCardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  historyCardQty: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
    marginLeft: 12,
  },
  expiryBadge: {
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
  },
  expiryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  historyCardMeta: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
  },
  historyCardObservation: {
    fontSize: 13,
    color: '#6B7280',
  },
  
  // Styles pour l'affichage du stock actuel
  currentStockInfoWeb: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currentStockItemWeb: {
    flex: 1,
  },
  currentStockLabelWeb: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
    fontWeight: '500',
  },
  currentStockValueWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
});

export default InventoryComponent;