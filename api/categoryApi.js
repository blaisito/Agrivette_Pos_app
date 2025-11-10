import { apiClient } from './client';

// API endpoints pour les catégories
const CATEGORY_ENDPOINTS = {
  CREATE: '/api/v1/Category/create-category',
  UPDATE: (categoryId) => `/api/v1/Category/update-category/${categoryId}?productId=${categoryId}`,
  DELETE: (categoryId) => `/api/v1/Category/delete-category/${categoryId}`,
  GET_BY_ID: (categoryId) => `/api/v1/Category/get-by-id/${categoryId}`,
  GET_ALL: '/api/v1/Category/get-all',
  GET_BY_KEYWORD: (keyword) => `/api/v1/Category/get-by-keyword/${keyword}`,
};

// Fonctions API pour les catégories
export const getCategories = async () => {
  const response = await apiClient.get(CATEGORY_ENDPOINTS.GET_ALL);
  return response;
};

export const getCategoryById = async (categoryId) => {
  const response = await apiClient.get(CATEGORY_ENDPOINTS.GET_BY_ID(categoryId));
  return response;
};

export const getCategoriesByKeyword = async (keyword) => {
  const response = await apiClient.get(CATEGORY_ENDPOINTS.GET_BY_KEYWORD(keyword));
  return response;
};

export const createCategory = async (categoryData) => {
  const response = await apiClient.post(CATEGORY_ENDPOINTS.CREATE, categoryData);
  return response;
};

export const updateCategory = async (categoryId, categoryData) => {
  const response = await apiClient.post(CATEGORY_ENDPOINTS.UPDATE(categoryId), categoryData);
  return response;
};

export const deleteCategory = async (categoryId) => {
  const response = await apiClient.delete(CATEGORY_ENDPOINTS.DELETE(categoryId));
  return response;
};
