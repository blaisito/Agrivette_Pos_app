import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { createDepense, deleteDepense, getDepensesByDateRange, updateDepense } from '../api/depenseApi';
import { getUserData } from '../utils/storage';
import BottomSheetCalendarModal from './ui/BottomSheetCalendarModal';
import CalendarModal from './ui/CalendarModal';

type TabKey = 'create' | 'report';
type DepenseRecord = Record<string, any>;

const DEFAULT_DEVISE = '1';
const deviseOptions = [
  { label: 'CDF', value: '1' },
  { label: 'USD', value: '2' },
];

const formatDateForDisplay = (date: Date) => {
  try {
    return date.toLocaleDateString('fr-FR');
  } catch (error) {
    return date.toISOString().split('T')[0];
  }
};

const formatDateForApi = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

const parseNumberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const isDeviseCdf = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  const normalized = String(value).trim().toUpperCase();
  return normalized === '1' || normalized === 'CDF';
};

const isDeviseUsd = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'number') {
    return value === 2;
  }

  const normalized = String(value).trim().toUpperCase();
  return normalized === '2' || normalized === 'USD';
};

const getAmountForCurrency = (item: DepenseRecord, currency: 'CDF' | 'USD'): number => {
  const candidateFields = currency === 'CDF'
    ? [item.amountCdf, item.montantCdf, item.totalCdf, item.priceCdf, item.total_cdf]
    : [item.amountUsd, item.montantUsd, item.totalUsd, item.priceUsd, item.total_usd];

  const baseFields = [item.amount, item.montant, item.total, item.value];

  const candidates = [...candidateFields, ...baseFields];

  for (const raw of candidates) {
    const parsed = parseNumberValue(raw);
    if (parsed !== null) {
      return parsed;
    }
  }

  return 0;
};

const formatNumber = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0,00';
  }

  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const extractAmount = (item: DepenseRecord): string => {
  const candidate =
    parseNumberValue(item.amount) ??
    parseNumberValue(item.montant) ??
    parseNumberValue(item.total) ??
    parseNumberValue(item.amountUsd) ??
    parseNumberValue(item.amountCdf);

  if (candidate === null) {
    return '—';
  }

  return candidate.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const extractDevise = (value: unknown): string => {
  if (value === 1 || value === '1') {
    return 'CDF';
  }
  if (value === 2 || value === '2') {
    return 'USD';
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return '—';
};

const extractDate = (item: DepenseRecord): string => {
  const rawValue =
    item.date ??
    item.createdOn ??
    item.createdAt ??
    item.creationDate ??
    item.createdDate ??
    item.timestamp ??
    item.insertedOn;

  if (!rawValue) {
    return '—';
  }

  try {
    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) {
      return String(rawValue);
    }
    return formatDateForDisplay(parsed);
  } catch (error) {
    return String(rawValue);
  }
};

const extractDescription = (item: DepenseRecord): string => {
  return (
    item.description ??
    item.libelle ??
    item.label ??
    item.title ??
    '—'
  );
};

const extractUserDisplay = (item: DepenseRecord): string => {
  return (
    item.userName ??
    item.username ??
    item.user ??
    item.userId ??
    item.createdBy ??
    '—'
  );
};

const extractCreatedDateTime = (item: DepenseRecord): string => {
  const rawValue = item.created ?? item.createdOn ?? item.creationDate ?? item.date;
  return formatDateTimeForDisplay(rawValue);
};

const extractUpdatedDateTime = (item: DepenseRecord): string => {
  const rawValue = item.updated ?? item.updatedOn ?? item.modifiedAt ?? item.modifiedOn;
  return formatDateTimeForDisplay(rawValue);
};

const getRecordKey = (item: DepenseRecord, index: number) => {
  return (
    item.id ??
    item.depenseId ??
    item.expenseId ??
    item.reference ??
    item.guid ??
    `depense-${index}`
  ).toString();
};

const getDepenseIdentifier = (item: DepenseRecord): string | null => {
  return (
    item.id ??
    item.depenseId ??
    item.expenseId ??
    item.reference ??
    item.guid ??
    null
  ) as string | null;
};

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatDateTimeForDisplay = (value: unknown): string => {
  if (!value) {
    return '—';
  }

  try {
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return `${date.toLocaleDateString('fr-FR')} ${date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  } catch (error) {
    return String(value);
  }
};

const generateDepensePrintHTML = (
  items: DepenseRecord[],
  totals: { totalCdf: number; totalUsd: number },
  range: { startDate: Date; endDate: Date },
  generatedAt: Date,
) => {
  const startLabel = formatDateForDisplay(range.startDate);
  const endLabel = formatDateForDisplay(range.endDate);
  const generatedLabel = formatDateForDisplay(generatedAt);

  const rowsHtml = items
    .map((item, index) => {
      const description = escapeHtml(String(extractDescription(item)));
      const amount = escapeHtml(String(extractAmount(item)));
      const devise = escapeHtml(String(extractDevise(item.devise)));
      const date = escapeHtml(String(extractDate(item)));
      const user = escapeHtml(String(extractUserDisplay(item)));
      const created = escapeHtml(String(extractCreatedDateTime(item)));
      const updated = escapeHtml(String(extractUpdatedDateTime(item)));

      return `
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #E5E7EB; text-align: center;">${index + 1}</td>
          <td style="padding: 10px 12px; border: 1px solid #E5E7EB;">${description}</td>
          <td style="padding: 10px 12px; border: 1px solid #E5E7EB; text-align: right; font-weight: 600;">${amount}</td>
          <td style="padding: 10px 12px; border: 1px solid #E5E7EB; text-align: center;">${devise}</td>
          <td style="padding: 10px 12px; border: 1px solid #E5E7EB; text-align: center;">${date}</td>
          <td style="padding: 10px 12px; border: 1px solid #E5E7EB;">${user}</td>
          <td style="padding: 10px 12px; border: 1px solid #E5E7EB; text-align: center;">${created}</td>
          <td style="padding: 10px 12px; border: 1px solid #E5E7EB; text-align: center;">${updated}</td>
        </tr>`;
    })
    .join('');

  const tableRows = rowsHtml ||
    '<tr><td colspan="8" style="padding: 16px; text-align: center; color: #6B7280; border: 1px solid #E5E7EB;">Aucune donnée disponible pour cette période.</td></tr>';

  return `<!DOCTYPE html>
  <html lang="fr">
    <head>
      <meta charSet="UTF-8" />
      <title>Rapport des dépenses</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          margin: 0;
          padding: 32px;
          background-color: #F9FAFB;
          color: #111827;
        }
        .container {
          max-width: 960px;
          margin: 0 auto;
          background-color: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #E5E7EB;
          padding: 32px;
          box-shadow: 0 20px 45px rgba(15, 23, 42, 0.15);
        }
        .brand {
          font-size: 34px;
          font-weight: 800;
          margin: 0;
          text-align: center;
          letter-spacing: 0.12em;
          color: #111827;
          text-transform: uppercase;
        }
        h2 {
          font-size: 24px;
          font-weight: 700;
          margin: 12px 0 0;
          text-align: center;
          color: #1F2937;
        }
        .subtitle {
          margin-top: 8px;
          font-size: 16px;
          color: #6B7280;
          text-align: center;
        }
        .meta {
          margin-top: 4px;
          font-size: 14px;
          color: #6B7280;
          text-align: center;
        }
        .totals {
          display: flex;
          gap: 16px;
          margin: 32px 0;
        }
        .total-card {
          flex: 1;
          border-radius: 12px;
          background-color: #F3F4F6;
          padding: 20px;
          border: 1px solid #E5E7EB;
          text-align: center;
        }
        .total-label {
          font-size: 14px;
          color: #6B7280;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .total-value {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 12px;
          overflow: hidden;
        }
        thead {
          background-color: #F3F4F6;
        }
        th {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 12px;
          border: 1px solid #E5E7EB;
          text-align: center;
        }
        tbody tr:nth-child(even) {
          background-color: #F9FAFB;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="brand">CHEZ JESSICA</h1>
        <h2>Rapport des dépenses</h2>
        <p class="subtitle">Période du ${startLabel} au ${endLabel}</p>
        <p class="meta">Généré le ${generatedLabel}</p>

        <div class="totals">
          <div class="total-card">
            <div class="total-label">Total CDF</div>
            <div class="total-value">${formatNumber(totals.totalCdf)} CDF</div>
          </div>
          <div class="total-card">
            <div class="total-label">Total USD</div>
            <div class="total-value">${formatNumber(totals.totalUsd)} USD</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 64px;">#</th>
              <th>Description</th>
              <th>Montant</th>
              <th>Devise</th>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Créé le</th>
              <th>Mis à jour le</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    </body>
  </html>`;
};

const determineDeviseValue = (item: DepenseRecord): string => {
  if (isDeviseCdf(item.devise)) {
    return '1';
  }
  if (isDeviseUsd(item.devise)) {
    return '2';
  }
  return DEFAULT_DEVISE;
};

const extractEditableAmount = (item: DepenseRecord): number => {
  if (isDeviseCdf(item.devise)) {
    return getAmountForCurrency(item, 'CDF');
  }
  if (isDeviseUsd(item.devise)) {
    return getAmountForCurrency(item, 'USD');
  }

  const fallback =
    parseNumberValue(item.amount) ??
    parseNumberValue(item.montant) ??
    parseNumberValue(item.total) ??
    parseNumberValue(item.amountCdf) ??
    parseNumberValue(item.amountUsd);

  return fallback ?? 0;
};

const formatAlertMessage = (title: string | undefined, message: string) => {
  if (!title) {
    return message;
  }
  return `${title}\n\n${message}`;
};

const showPlatformAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(formatAlertMessage(title, message));
    }
  } else {
    Alert.alert(title, message);
  }
};

const showPlatformConfirm = (
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
  cancelText: string = 'Annuler'
) => {
  if (Platform.OS === 'web') {
    const formatted = formatAlertMessage(title, message);
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(formatted);
      if (confirmed) {
        onConfirm();
      }
    }
  } else {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel' },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ]);
  }
};

const setToStartOfDay = (date: Date) => {
  const normalized = new Date(date.getTime());
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const setToEndOfDay = (date: Date) => {
  const normalized = new Date(date.getTime());
  normalized.setHours(23, 59, 59, 999);
  return normalized;
};

const DepenseComponent = () => {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 900;

  const [activeTab, setActiveTab] = useState<TabKey>('create');

  const [formState, setFormState] = useState({
    userId: '',
    amount: '',
    devise: DEFAULT_DEVISE,
    description: '',
  });
  const [userDisplayName, setUserDisplayName] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState<Date>(() => setToStartOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => setToEndOfDay(new Date()));
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [showMobileStartDateModal, setShowMobileStartDateModal] = useState(false);
  const [showMobileEndDateModal, setShowMobileEndDateModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportData, setReportData] = useState<DepenseRecord[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printGeneratedAt, setPrintGeneratedAt] = useState<Date | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingDepense, setEditingDepense] = useState<DepenseRecord | null>(null);
  const [editFormState, setEditFormState] = useState({
    amount: '',
    devise: DEFAULT_DEVISE,
    description: '',
  });
  const [isUpdatingDepense, setIsUpdatingDepense] = useState(false);
  const [isDeletingDepense, setIsDeletingDepense] = useState(false);

  const { totalCdf, totalUsd } = useMemo(() => {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return { totalCdf: 0, totalUsd: 0 };
    }

    let sumCdf = 0;
    let sumUsd = 0;

    for (const item of reportData) {
      const amountCdf = getAmountForCurrency(item, 'CDF');
      const amountUsd = getAmountForCurrency(item, 'USD');
      const hasCdfDevise = isDeviseCdf(item.devise);
      const hasUsdDevise = isDeviseUsd(item.devise);

      if (hasCdfDevise) {
        sumCdf += amountCdf || amountUsd * (item.taux ?? 0);
      } else if (hasUsdDevise) {
        sumUsd += amountUsd || amountCdf / (item.taux ?? 1);
      } else {
        if (amountCdf) {
          sumCdf += amountCdf;
        }
        if (amountUsd) {
          sumUsd += amountUsd;
        }
      }
    }

    return { totalCdf: sumCdf, totalUsd: sumUsd };
  }, [reportData]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await getUserData();
        if (user?.id) {
          setFormState((prev) => ({ ...prev, userId: user.id }));
          const displayName = user.username || user.email || user.fullName || user.name || 'Utilisateur';
          setUserDisplayName(displayName);
        }
      } catch (error) {
        console.warn('Impossible de charger les informations utilisateur pour les dépenses.', error);
      }
    };

    loadUser();
  }, []);

  const handleInputChange = useCallback((field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const validateForm = () => {
    if (!formState.userId.trim()) {
      showPlatformAlert('Utilisateur requis', "L'identifiant utilisateur est requis pour enregistrer une dépense.");
      return false;
    }

    const amountValue = parseNumberValue(formState.amount);
    if (amountValue === null || amountValue <= 0) {
      showPlatformAlert('Montant invalide', 'Veuillez saisir un montant supérieur à 0.');
      return false;
    }

    if (!formState.devise) {
      showPlatformAlert('Devise requise', 'Veuillez sélectionner la devise de la dépense.');
      return false;
    }

    if (!formState.description.trim()) {
      showPlatformAlert('Description requise', 'Veuillez ajouter une description pour la dépense.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    const payload = {
      userId: formState.userId.trim(),
      amount: parseNumberValue(formState.amount) ?? 0,
      devise: Number(formState.devise),
      description: formState.description.trim(),
    };

    try {
      setIsSubmitting(true);
      const response = await createDepense(payload);
      if (response?.success === false) {
        throw new Error(response?.message || 'La création de la dépense a échoué.');
      }

      showPlatformAlert('Succès', 'La dépense a été enregistrée avec succès.');
      setFormState((prev) => ({
        ...prev,
        amount: '',
        description: '',
      }));
    } catch (error: any) {
      const message = error?.message || "Une erreur est survenue lors de l'enregistrement de la dépense.";
      showPlatformAlert('Erreur', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateDateRange = () => {
    if (endDate < startDate) {
      showPlatformAlert('Plage de dates invalide', 'La date de fin doit être postérieure à la date de début.');
      return false;
    }
    return true;
  };

  const handleFetchReport = async () => {
    if (!validateDateRange()) {
      return;
    }

    try {
      setReportLoading(true);
      setReportError(null);
      const response = await getDepensesByDateRange(
        formatDateForApi(startDate),
        formatDateForApi(endDate)
      );
      const items = response?.data;
      if (!Array.isArray(items)) {
        setReportData([]);
        if (response?.message) {
          setReportError(response.message);
        }
        return;
      }
      setReportData(items);
    } catch (error: any) {
      const message = error?.message || 'Impossible de récupérer les dépenses pour cette période.';
      setReportError(message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleOpenPrintModal = () => {
    if (reportData.length === 0) {
      showPlatformAlert('Aucune donnée', 'Veuillez charger un rapport avant de lancer l\'impression.');
      return;
    }

    setPrintGeneratedAt(new Date());
    setShowPrintModal(true);
  };

  const handleClosePrintModal = () => {
    setShowPrintModal(false);
  };

  const handlePrintPdf = () => {
    if (reportData.length === 0) {
      showPlatformAlert('Aucune donnée', 'Veuillez charger un rapport avant de lancer l\'impression.');
      return;
    }

    const generatedAt = printGeneratedAt || new Date();

    if (Platform.OS === 'web') {
      try {
        const html = generateDepensePrintHTML(
          reportData,
          { totalCdf, totalUsd },
          { startDate, endDate },
          generatedAt,
        );

        const printWindow = typeof globalThis !== 'undefined' && typeof (globalThis as any).open === 'function'
          ? (globalThis as any).open('', '_blank', 'width=1024,height=720')
          : null;

        if (!printWindow) {
          showPlatformAlert('Fenêtre bloquée', 'Veuillez autoriser les pop-ups pour imprimer le rapport.');
          return;
        }

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 400);
        };
      } catch (error) {
        console.error('Erreur lors de la génération du PDF des dépenses :', error);
        showPlatformAlert('Erreur', "Impossible de générer le rapport à imprimer. Veuillez réessayer.");
      }
      return;
    }

    showPlatformAlert(
      'Impression disponible sur le web',
      "La génération automatique en PDF est actuellement disponible depuis la version web."
    );
  };

  const openEditDepenseModal = (depense: DepenseRecord) => {
    const amountValue = extractEditableAmount(depense);
    const descriptionValue = extractDescription(depense);

    setEditingDepense(depense);
    setEditFormState({
      amount: amountValue ? amountValue.toString() : '',
      devise: determineDeviseValue(depense),
      description: descriptionValue === '—' ? '' : descriptionValue,
    });
    setEditModalVisible(true);
  };

  const closeEditDepenseModal = () => {
    setEditModalVisible(false);
    setEditingDepense(null);
    setEditFormState({ amount: '', devise: DEFAULT_DEVISE, description: '' });
    setIsUpdatingDepense(false);
    setIsDeletingDepense(false);
  };

  const handleEditFormChange = (field: 'amount' | 'devise' | 'description', value: string) => {
    setEditFormState((prev) => ({ ...prev, [field]: value }));
  };

  const submitDepenseUpdate = async () => {
    if (!editingDepense) {
      return;
    }

    const depenseId = getDepenseIdentifier(editingDepense);
    if (!depenseId) {
      showPlatformAlert('Erreur', 'Impossible de déterminer l\'identifiant de la dépense à mettre à jour.');
      return;
    }

    const amountValue = parseNumberValue(editFormState.amount);
    if (amountValue === null || amountValue <= 0) {
      showPlatformAlert('Montant invalide', 'Veuillez saisir un montant supérieur à 0.');
      return;
    }

    const descriptionValue = editFormState.description.trim();
    if (!descriptionValue) {
      showPlatformAlert('Description requise', 'Veuillez ajouter une description pour la dépense.');
      return;
    }

    const payload = {
      amount: amountValue,
      devise: Number(editFormState.devise),
      description: descriptionValue,
    };

    try {
      setIsUpdatingDepense(true);
      const response = await updateDepense(depenseId, payload);

      if (response?.success === false) {
        throw new Error(response?.message || 'La mise à jour de la dépense a échoué.');
      }

      showPlatformAlert('Succès', 'Dépense mise à jour avec succès.');
      await handleFetchReport();
      closeEditDepenseModal();
    } catch (error: any) {
      const message = error?.message || 'Une erreur est survenue lors de la mise à jour de la dépense.';
      showPlatformAlert('Erreur', message);
      setIsUpdatingDepense(false);
    }
  };

  const handleConfirmDeleteDepense = async () => {
    if (!editingDepense) {
      return;
    }

    const depenseId = getDepenseIdentifier(editingDepense);
    if (!depenseId) {
      showPlatformAlert('Erreur', 'Impossible de déterminer l\'identifiant de la dépense à supprimer.');
      return;
    }

    try {
      setIsDeletingDepense(true);
      const response = await deleteDepense(depenseId);

      if (response?.success === false) {
        throw new Error(response?.message || 'La suppression de la dépense a échoué.');
      }

      showPlatformAlert('Succès', 'Dépense supprimée avec succès.');
      await handleFetchReport();
      closeEditDepenseModal();
    } catch (error: any) {
      const message = error?.message || 'Une erreur est survenue lors de la suppression de la dépense.';
      showPlatformAlert('Erreur', message);
      setIsDeletingDepense(false);
    }
  };

  const requestDeleteDepense = () => {
    showPlatformConfirm(
      'Supprimer la dépense ?',
      'Cette action est définitive. Êtes-vous sûr de vouloir supprimer cette dépense ?',
      'Supprimer',
      handleConfirmDeleteDepense
    );
  };

  const openStartDatePicker = () => {
    if (Platform.OS === 'web') {
      setShowStartDateModal(true);
    } else {
      setShowMobileStartDateModal(true);
    }
  };

  const openEndDatePicker = () => {
    if (Platform.OS === 'web') {
      setShowEndDateModal(true);
    } else {
      setShowMobileEndDateModal(true);
    }
  };

  const handleStartDateSelect = (date: Date) => {
    setStartDate(setToStartOfDay(date));
    if (Platform.OS === 'web') {
      setShowStartDateModal(false);
    } else {
      setShowMobileStartDateModal(false);
    }
  };

  const handleEndDateSelect = (date: Date) => {
    setEndDate(setToEndOfDay(date));
    if (Platform.OS === 'web') {
      setShowEndDateModal(false);
    } else {
      setShowMobileEndDateModal(false);
    }
  };

  const isSubmitDisabled = useMemo(() => {
    return (
      isSubmitting ||
      !formState.userId.trim() ||
      !formState.description.trim() ||
      (parseNumberValue(formState.amount) ?? 0) <= 0
    );
  }, [formState, isSubmitting]);

  const containerStyle = isLargeScreen ? styles.containerWebContent : styles.containerMobileContent;
  const tabButtonStyle = isLargeScreen ? styles.tabButtonWeb : styles.tabButtonMobile;
  const tabButtonActiveStyle = isLargeScreen ? styles.tabButtonWebActive : styles.tabButtonMobileActive;

  const renderTabSelector = () => (
    <View style={[styles.tabBar, isLargeScreen ? styles.tabBarWeb : styles.tabBarMobile]}>
      <TouchableOpacity
        onPress={() => setActiveTab('create')}
        style={[tabButtonStyle, activeTab === 'create' && tabButtonActiveStyle]}
      >
        <Ionicons
          name="create"
          size={18}
          color={activeTab === 'create' ? '#FFFFFF' : '#6B7280'}
        />
        <Text
          style={[styles.tabButtonText, activeTab === 'create' && styles.tabButtonTextActive]}
        >
          Enregistrer la dépense
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setActiveTab('report')}
        style={[tabButtonStyle, activeTab === 'report' && tabButtonActiveStyle]}
      >
        <Ionicons
          name="bar-chart"
          size={18}
          color={activeTab === 'report' ? '#FFFFFF' : '#6B7280'}
        />
        <Text
          style={[styles.tabButtonText, activeTab === 'report' && styles.tabButtonTextActive]}
        >
          Rapport des dépenses
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderCreateTab = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Nouvelle dépense</Text>
      <Text style={styles.cardSubtitle}>
        Enregistrez les dépenses effectuées par votre équipe avec la devise adéquate.
      </Text>

      <View style={[styles.formRow, isLargeScreen && styles.formRowLarge]}>
        <View style={[styles.formGroup, isLargeScreen && styles.formGroupLarge]}>
          <Text style={styles.formLabel}>Identifiant utilisateur</Text>
          <TextInput
            value={userDisplayName ? `${userDisplayName}` : formState.userId}
            onChangeText={(text) => handleInputChange('userId', text)}
            placeholder="UUID de l'utilisateur"
            style={styles.inputReadOnly}
            autoCapitalize="none"
            editable={false}
          />
        </View>
        <View style={[styles.formGroup, isLargeScreen && styles.formGroupLarge]}>
          <Text style={styles.formLabel}>Montant</Text>
          <TextInput
            value={formState.amount}
            onChangeText={(text) => handleInputChange('amount', text)}
            placeholder="0.00"
            style={styles.input}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={[styles.formRow, isLargeScreen && styles.formRowLarge]}>
        <View style={[styles.formGroup, isLargeScreen && styles.formGroupLarge]}>
          <Text style={styles.formLabel}>Devise</Text>
          <View style={styles.toggleGroup}>
            {deviseOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => handleInputChange('devise', option.value)}
                style={[
                  styles.toggleButton,
                  formState.devise === option.value && styles.toggleButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    formState.devise === option.value && styles.toggleButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>Description</Text>
        <TextInput
          value={formState.description}
          onChangeText={(text) => handleInputChange('description', text)}
          placeholder="Ex : Achat de fournitures"
          style={[styles.input, styles.textArea]}
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitDisabled && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitDisabled}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Enregistrer la dépense</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderReportTab = () => {
    const isPrintDisabled = reportLoading || reportData.length === 0;

    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rapport des dépenses</Text>
        <Text style={styles.cardSubtitle}>
          Sélectionnez une plage de dates pour afficher les dépenses enregistrées.
        </Text>

        <View style={[styles.dateRow, isLargeScreen && styles.dateRowLarge]}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={openStartDatePicker}
          >
            <Ionicons name="calendar" size={18} color="#6B7280" />
            <Text style={styles.dateButtonText}>Du {formatDateForDisplay(startDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={openEndDatePicker}
          >
            <Ionicons name="calendar" size={18} color="#6B7280" />
            <Text style={styles.dateButtonText}>Au {formatDateForDisplay(endDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleFetchReport}
            disabled={reportLoading}
          >
            {reportLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.refreshButtonText}>Charger</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.printButton, isPrintDisabled && styles.printButtonDisabled]}
            onPress={handleOpenPrintModal}
            disabled={isPrintDisabled}
          >
            <Ionicons name="print" size={18} color="#FFFFFF" />
            <Text style={styles.printButtonText}>Imprimer</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.totalsContainer, isLargeScreen ? styles.totalsContainerWeb : styles.totalsContainerMobile]}>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total CDF</Text>
            <Text style={styles.totalValue}>{formatNumber(totalCdf)} CDF</Text>
          </View>
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total USD</Text>
            <Text style={styles.totalValue}>{formatNumber(totalUsd)} USD</Text>
          </View>
        </View>

        {/* Sélecteurs de dates réutilisés depuis ReportsComponent */}
        {Platform.OS === 'web' ? (
          <>
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
          </>
        ) : (
          <>
          <BottomSheetCalendarModal
            visible={showMobileStartDateModal}
            onClose={() => setShowMobileStartDateModal(false)}
            selectedDate={startDate}
            onDateSelect={handleStartDateSelect}
            title="Sélectionner la date de début"
          />
          <BottomSheetCalendarModal
            visible={showMobileEndDateModal}
            onClose={() => setShowMobileEndDateModal(false)}
            selectedDate={endDate}
            onDateSelect={handleEndDateSelect}
            title="Sélectionner la date de fin"
          />
          </>
        )}

        {reportError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={18} color="#B45309" />
            <Text style={styles.errorBannerText}>{reportError}</Text>
          </View>
        )}

        {!reportLoading && reportData.length === 0 && !reportError && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text" size={36} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Aucune dépense trouvée</Text>
            <Text style={styles.emptySubtitle}>
              Lancez une recherche pour afficher les dépenses enregistrées.
            </Text>
          </View>
        )}

        {reportData.length > 0 && (
          <View>
            {isLargeScreen ? (
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeadCell, styles.flex2]}>Description</Text>
                  <Text style={styles.tableHeadCell}>Montant</Text>
                  <Text style={styles.tableHeadCell}>Devise</Text>
                  <Text style={styles.tableHeadCell}>Utilisateur</Text>
                  <Text style={styles.tableHeadCell}>Créé le</Text>
                  <Text style={styles.tableHeadCell}>Mis à jour le</Text>
                </View>
                {reportData.map((item, index) => (
                  <TouchableOpacity
                    key={getRecordKey(item, index)}
                    style={styles.tableRow}
                    activeOpacity={0.8}
                    onPress={() => openEditDepenseModal(item)}
                  >
                    <Text style={[styles.tableCell, styles.flex2]}>{extractDescription(item)}</Text>
                    <Text style={styles.tableCell}>{extractAmount(item)}</Text>
                    <Text style={styles.tableCell}>{extractDevise(item.devise)}</Text>
                    <Text style={styles.tableCell}>{extractUserDisplay(item)}</Text>
                    <Text style={styles.tableCell}>{extractCreatedDateTime(item)}</Text>
                    <Text style={styles.tableCell}>{extractUpdatedDateTime(item)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.cardsList}>
                {reportData.map((item, index) => (
                  <TouchableOpacity
                    key={getRecordKey(item, index)}
                    style={styles.reportCard}
                    activeOpacity={0.85}
                    onPress={() => openEditDepenseModal(item)}
                  >
                    <View style={styles.reportCardHeader}>
                      <Text style={styles.reportCardTitle}>{extractDescription(item)}</Text>
                      <Text style={styles.reportCardAmount}>{extractAmount(item)}</Text>
                    </View>
                    <View style={styles.reportCardRow}>
                      <Ionicons name="cash" size={16} color="#6B7280" />
                      <Text style={styles.reportCardMeta}>{extractDevise(item.devise)}</Text>
                    </View>
                    <View style={styles.reportCardRow}>
                      <Ionicons name="calendar" size={16} color="#6B7280" />
                      <Text style={styles.reportCardMeta}>{extractDate(item)}</Text>
                    </View>
                    <View style={styles.reportCardRow}>
                      <Ionicons name="person" size={16} color="#6B7280" />
                      <Text style={styles.reportCardMeta}>{extractUserDisplay(item)}</Text>
                    </View>
                    <View style={styles.reportCardRow}>
                      <Ionicons name="time" size={16} color="#059669" />
                      <Text style={styles.reportCardMeta}>Créé : {extractCreatedDateTime(item)}</Text>
                    </View>
                    <View style={styles.reportCardRow}>
                      <Ionicons name="refresh" size={16} color="#F59E0B" />
                      <Text style={styles.reportCardMeta}>MAJ : {extractUpdatedDateTime(item)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderEditModal = () => {
    const isSaveDisabled =
      isUpdatingDepense || isDeletingDepense || !editFormState.amount.trim() || !editFormState.description.trim();

    return (
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeEditDepenseModal}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <Text style={styles.editModalTitle}>Modifier la dépense</Text>
            <TouchableOpacity onPress={closeEditDepenseModal} style={styles.editModalCloseButton}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.editModalBody}>
            <View style={styles.editModalField}>
              <Text style={styles.editModalLabel}>Montant</Text>
              <TextInput
                value={editFormState.amount}
                onChangeText={(value) => handleEditFormChange('amount', value)}
                placeholder="0.00"
                keyboardType="decimal-pad"
                style={styles.editModalInput}
              />
            </View>

            <View style={styles.editModalField}>
              <Text style={styles.editModalLabel}>Devise</Text>
              <View style={styles.toggleGroup}>
                {deviseOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => handleEditFormChange('devise', option.value)}
                    style={[
                      styles.toggleButton,
                      editFormState.devise === option.value && styles.toggleButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        editFormState.devise === option.value && styles.toggleButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.editModalField}>
              <Text style={styles.editModalLabel}>Description</Text>
              <TextInput
                value={editFormState.description}
                onChangeText={(value) => handleEditFormChange('description', value)}
                placeholder="Description de la dépense"
                style={[styles.editModalInput, styles.editModalTextarea]}
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

            <View style={styles.editModalActions}>
              <TouchableOpacity
                style={[styles.editModalDeleteButton, isDeletingDepense && styles.editModalDeleteButtonDisabled]}
                onPress={requestDeleteDepense}
                disabled={isDeletingDepense || isUpdatingDepense}
              >
                {isDeletingDepense ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.editModalDeleteText}>Supprimer</Text>
                )}
              </TouchableOpacity>
            <TouchableOpacity
              style={styles.editModalCancelButton}
              onPress={closeEditDepenseModal}
                disabled={isUpdatingDepense || isDeletingDepense}
            >
              <Text style={styles.editModalCancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.editModalSaveButton,
                  isSaveDisabled && styles.editModalSaveButtonDisabled,
              ]}
              onPress={submitDepenseUpdate}
                disabled={isSaveDisabled}
            >
              {isUpdatingDepense ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.editModalSaveText}>Enregistrer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </Modal>
    );
  };

  const renderPrintPreviewModal = () => {
    const generatedLabel = formatDateForDisplay(printGeneratedAt || new Date());

    return (
      <Modal
        visible={showPrintModal}
        transparent
        animationType="fade"
        onRequestClose={handleClosePrintModal}
      >
        <View style={styles.printModalOverlay}>
          <View
            style={[
              styles.printModalContainer,
              isLargeScreen ? styles.printModalContainerWeb : styles.printModalContainerMobile,
            ]}
          >
            <View style={styles.printModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.printModalTitle}>Aperçu du rapport des dépenses</Text>
                <Text style={styles.printModalSubtitle}>
                  Période du {formatDateForDisplay(startDate)} au {formatDateForDisplay(endDate)}
                </Text>
                <Text style={styles.printModalMeta}>Généré le {generatedLabel}</Text>
              </View>
              <TouchableOpacity onPress={handleClosePrintModal} style={styles.printModalCloseButton}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.printModalScroll} contentContainerStyle={styles.printModalContent}>
              <View style={styles.printModalSummaryRow}>
                <View style={styles.printModalSummaryCard}>
                  <Text style={styles.printModalSummaryLabel}>Total CDF</Text>
                  <Text style={styles.printModalSummaryValue}>{formatNumber(totalCdf)} CDF</Text>
                </View>
                <View style={styles.printModalSummaryCard}>
                  <Text style={styles.printModalSummaryLabel}>Total USD</Text>
                  <Text style={styles.printModalSummaryValue}>{formatNumber(totalUsd)} USD</Text>
                </View>
              </View>

              <View style={styles.printModalTableContainer}>
                {reportData.length === 0 ? (
                  <View style={styles.printModalEmpty}>
                    <Ionicons name="document-text" size={36} color="#9CA3AF" />
                    <Text style={styles.printModalEmptyTitle}>Aucune dépense à afficher</Text>
                    <Text style={styles.printModalEmptySubtitle}>
                      Lancez une recherche pour voir les données du rapport.
                    </Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View>
                      <View style={styles.printModalTableHeaderRow}>
                        <Text style={[styles.printModalTableHeaderCell, styles.printModalTableCellIndex]}>#</Text>
                        <Text style={[styles.printModalTableHeaderCell, styles.printModalTableCellDescription]}>Description</Text>
                        <Text style={[styles.printModalTableHeaderCell, styles.printModalTableCellAmount]}>Montant</Text>
                        <Text style={[styles.printModalTableHeaderCell, styles.printModalTableCellDevise]}>Devise</Text>
                        <Text style={[styles.printModalTableHeaderCell, styles.printModalTableCellDate]}>Date</Text>
                        <Text style={[styles.printModalTableHeaderCell, styles.printModalTableCellUser]}>Utilisateur</Text>
                        <Text style={[styles.printModalTableHeaderCell, styles.printModalTableCellDate]}>Créé le</Text>
                        <Text style={[styles.printModalTableHeaderCell, styles.printModalTableCellDate]}>Mis à jour le</Text>
                      </View>

                      {reportData.map((item, index) => (
                        <View key={getRecordKey(item, index)} style={styles.printModalTableRow}>
                          <Text style={[styles.printModalTableCell, styles.printModalTableCellIndex]}>{index + 1}</Text>
                          <Text style={[styles.printModalTableCell, styles.printModalTableCellDescription]}>{extractDescription(item)}</Text>
                          <Text style={[styles.printModalTableCell, styles.printModalTableCellAmount]}>{extractAmount(item)}</Text>
                          <Text style={[styles.printModalTableCell, styles.printModalTableCellDevise]}>{extractDevise(item.devise)}</Text>
                          <Text style={[styles.printModalTableCell, styles.printModalTableCellDate]}>{extractDate(item)}</Text>
                          <Text style={[styles.printModalTableCell, styles.printModalTableCellUser]}>{extractUserDisplay(item)}</Text>
                          <Text style={[styles.printModalTableCell, styles.printModalTableCellDate]}>{extractCreatedDateTime(item)}</Text>
                          <Text style={[styles.printModalTableCell, styles.printModalTableCellDate]}>{extractUpdatedDateTime(item)}</Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
            </ScrollView>

            <View style={styles.printModalFooter}>
              <TouchableOpacity style={styles.printModalPrimaryButton} onPress={handlePrintPdf}>
                <Ionicons name="print" size={18} color="#FFFFFF" />
                <Text style={styles.printModalPrimaryButtonText}>
                  {Platform.OS === 'web' ? 'Imprimer maintenant' : 'Partager en PDF (web)'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.printModalSecondaryButton} onPress={handleClosePrintModal}>
                <Text style={styles.printModalSecondaryButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <>
      <ScrollView style={styles.wrapper} contentContainerStyle={containerStyle}>
        <View style={styles.headerSection}>
          <Text style={isLargeScreen ? styles.titleWeb : styles.titleMobile}>Gestion des dépenses</Text>
          <Text style={styles.subtitle}>
            Centralisez vos dépenses et visualisez vos rapports financiers en temps réel.
          </Text>
        </View>

        {renderTabSelector()}

        <View style={styles.tabContent}>{activeTab === 'create' ? renderCreateTab() : renderReportTab()}</View>
      </ScrollView>
      {renderPrintPreviewModal()}
      {renderEditModal()}
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  containerWebContent: {
    paddingHorizontal: 80,
    paddingVertical: 32,
    alignItems: 'stretch',
    gap: 24,
  },
  containerMobileContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 24,
  },
  headerSection: {
    gap: 8,
  },
  titleWeb: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1F2937',
  },
  titleMobile: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
  },
  tabBar: {
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    padding: 6,
    flexDirection: 'row',
  },
  tabBarWeb: {
    alignSelf: 'flex-start',
    maxWidth: 520,
  },
  tabBarMobile: {
    alignSelf: 'stretch',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  tabButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tabButtonWebActive: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  tabButtonMobile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  tabButtonMobileActive: {
    backgroundColor: '#7C3AED',
    elevation: 2,
  },
  tabContent: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  formRow: {
    gap: 16,
  },
  formRowLarge: {
    flexDirection: 'row',
  },
  formGroup: {
    gap: 8,
  },
  formGroupLarge: {
    flex: 1,
  },
  formLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputReadOnly: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#7C3AED',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#7C3AED',
  },
  submitButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'column',
    gap: 12,
  },
  dateRowLarge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#374151',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  printButtonDisabled: {
    opacity: 0.5,
  },
  printButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  totalsContainer: {
    marginTop: 12,
    gap: 12,
  },
  totalsContainerWeb: {
    flexDirection: 'row',
  },
  totalsContainerMobile: {
    flexDirection: 'column',
  },
  totalCard: {
    flex: 1,
    backgroundColor: '#F4F4FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  totalLabel: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  pickerContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 8,
    gap: 8,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  errorBannerText: {
    fontSize: 14,
    color: '#92400E',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableHeadCell: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  flex2: {
    flex: 2,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
  },
  cardsList: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  reportCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  reportCardAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  reportCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportCardMeta: {
    fontSize: 16,
    color: '#4B5563',
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContainer: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    gap: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 8,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  editModalCloseButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  editModalBody: {
    gap: 16,
  },
  editModalField: {
    gap: 8,
  },
  editModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  editModalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  editModalTextarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  editModalDeleteButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 'auto',
  },
  editModalDeleteButtonDisabled: {
    opacity: 0.6,
  },
  editModalDeleteText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editModalCancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  editModalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  editModalSaveButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalSaveButtonDisabled: {
    opacity: 0.6,
  },
  editModalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  printModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  printModalContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
    elevation: 12,
  },
  printModalContainerWeb: {
    maxWidth: 900,
  },
  printModalContainerMobile: {
    maxHeight: '90%',
  },
  printModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  printModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  printModalSubtitle: {
    fontSize: 14,
    color: '#4B5563',
  },
  printModalMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B7280',
  },
  printModalCloseButton: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  printModalScroll: {
    flex: 1,
  },
  printModalContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 20,
  },
  printModalSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  printModalSummaryCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  printModalSummaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  printModalSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  printModalTableContainer: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  printModalEmpty: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  printModalEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  printModalEmptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  printModalTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  printModalTableHeaderCell: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.05,
  },
  printModalTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  printModalTableCell: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 13,
    color: '#4B5563',
  },
  printModalTableCellIndex: {
    minWidth: 60,
    textAlign: 'center',
  },
  printModalTableCellDescription: {
    minWidth: 220,
    flexShrink: 1,
  },
  printModalTableCellAmount: {
    minWidth: 140,
    textAlign: 'right',
    fontWeight: '600',
    color: '#2563EB',
  },
  printModalTableCellDevise: {
    minWidth: 110,
    textAlign: 'center',
  },
  printModalTableCellDate: {
    minWidth: 180,
    textAlign: 'center',
  },
  printModalTableCellUser: {
    minWidth: 180,
  },
  printModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  printModalPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1F2937',
  },
  printModalPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  printModalSecondaryButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  printModalSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA',
  },
});

export default DepenseComponent;

