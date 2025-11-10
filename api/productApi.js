import { apiClient } from './client';

// API endpoints pour les produits
const PRODUCT_ENDPOINTS = {
  CREATE: '/api/v1/Product/create-product',
  UPDATE: (productId) => `/api/v1/Product/update-product/${productId}?productId=${productId}`,
  DELETE: (productId) => `/api/v1/Product/delete-product/${productId}`,
  GET_BY_ID: (productId) => `/api/v1/Product/get-by-id/${productId}`,
  GET_ALL: '/api/v1/Product/get-all',
  GET_BY_KEYWORD: (keyword) => `/api/v1/Product/get-by-keyword/${keyword}`,
  GET_BY_CATEGORY: (categoryId) => `/api/v1/Product/get-by-category/${categoryId}`,
};

// Fonctions API pour les produits
export const getProducts = async () => {
  const response = await apiClient.get(PRODUCT_ENDPOINTS.GET_ALL);
  return response;
};

export const getProductById = async (productId) => {
  const response = await apiClient.get(PRODUCT_ENDPOINTS.GET_BY_ID(productId));
  return response;
};

export const getProductsByKeyword = async (keyword) => {
  const response = await apiClient.get(PRODUCT_ENDPOINTS.GET_BY_KEYWORD(keyword));
  return response;
};

export const getProductsByCategory = async (categoryId) => {
  const response = await apiClient.get(PRODUCT_ENDPOINTS.GET_BY_CATEGORY(categoryId));
  return response;
};

export const createProduct = async (productData) => {
  const response = await apiClient.post(PRODUCT_ENDPOINTS.CREATE, productData);
  return response;
};

export const updateProduct = async (productId, productData) => {
  const response = await apiClient.post(PRODUCT_ENDPOINTS.UPDATE(productId), productData);
  return response;
};

export const deleteProduct = async (productId) => {
  const response = await apiClient.delete(PRODUCT_ENDPOINTS.DELETE(productId));
  return response;
};
