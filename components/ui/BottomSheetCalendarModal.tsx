import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface BottomSheetCalendarModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  title: string;
}

const BottomSheetCalendarModal: React.FC<BottomSheetCalendarModalProps> = ({
  visible,
  onClose,
  selectedDate,
  onDateSelect,
  title
}) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth());
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  
  // États pour la sélection d'heure
  const [selectedHour, setSelectedHour] = useState(selectedDate.getHours());
  const [selectedMinute, setSelectedMinute] = useState(selectedDate.getMinutes());
  const [selectedDay, setSelectedDay] = useState(selectedDate.getDate());

  // Fonction pour obtenir les jours du mois
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Fonction pour obtenir le premier jour du mois
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  // Fonction pour générer les jours du mois
  const generateDays = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days = [];

    // Ajouter les jours vides du début
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Ajouter les jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  // Fonction pour changer de mois
  const changeMonth = (direction: 'prev' | 'next') => {
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

  // Fonction pour sélectionner une date
  const selectDate = (day: number) => {
    setSelectedDay(day);
  };

  // Fonction pour confirmer la sélection
  const confirmSelection = () => {
    if (selectedDay) {
      const newDate = new Date(currentYear, currentMonth, selectedDay, selectedHour, selectedMinute);

      onDateSelect(newDate);
      onClose();
    }
  };

  // Fonction pour vérifier si une date est sélectionnée
  const isSelectedDate = (day: number) => {
    return day === selectedDay;
  };

  // Fonction pour vérifier si une date est aujourd'hui
  const isToday = (day: number) => {
    const today = new Date();
    const dateToCheck = new Date(currentYear, currentMonth, day);
    return (
      dateToCheck.getDate() === today.getDate() &&
      dateToCheck.getMonth() === today.getMonth() &&
      dateToCheck.getFullYear() === today.getFullYear()
    );
  };

  // Noms des mois en français
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  // Noms des jours en français
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const days = generateDays();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header avec titre et bouton fermer */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.calendarContainer}>
            {/* Header du calendrier avec navigation */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => changeMonth('prev')}
              >
                <Ionicons name="chevron-back" size={20} color="#007AFF" />
              </TouchableOpacity>
              
              <View style={styles.monthYearContainer}>
                <Text style={styles.monthYearText}>
                  {monthNames[currentMonth]} {currentYear}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => changeMonth('next')}
              >
                <Ionicons name="chevron-forward" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>

            {/* Jours de la semaine */}
            <View style={styles.dayNamesContainer}>
              {dayNames.map((dayName, index) => (
                <Text key={index} style={styles.dayName}>
                  {dayName}
                </Text>
              ))}
            </View>

            {/* Grille du calendrier */}
            <View style={styles.calendarGrid}>
              {days.map((day, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayButton,
                    day && isSelectedDate(day) && styles.selectedDay,
                    day && isToday(day) && styles.todayDay,
                    !day && styles.emptyDay
                  ]}
                  onPress={() => day && selectDate(day)}
                  disabled={!day}
                >
                  {day && (
                    <Text
                      style={[
                        styles.dayText,
                        isSelectedDate(day) && styles.selectedDayText,
                        isToday(day) && !isSelectedDate(day) && styles.todayDayText
                      ]}
                    >
                      {day}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Sélection d'heure */}
            <View style={styles.timeSelectionContainer}>
              <Text style={styles.timeSelectionLabel}>Heure:</Text>
              <View style={styles.timeInputContainer}>
                {/* Bouton - pour les heures */}
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => {
                    const newHour = selectedHour > 0 ? selectedHour - 1 : 23;
                    setSelectedHour(newHour);
                  }}
                >
                  <Ionicons name="remove" size={16} color="#007AFF" />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.timeInput}
                  value={selectedHour.toString().padStart(2, '0')}
                  onChangeText={(text) => {
                    // Nettoyer le texte pour ne garder que les chiffres
                    const cleanText = text.replace(/[^0-9]/g, '');
                    
                    if (cleanText === '') {
                      setSelectedHour(0);
                      return;
                    }
                    
                    const hour = parseInt(cleanText);
                    if (!isNaN(hour)) {
                      // Limiter à 23 maximum
                      const validHour = Math.min(hour, 23);
                      setSelectedHour(validHour);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  selectTextOnFocus={true}
                />
                
                {/* Bouton + pour les heures */}
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => {
                    const newHour = selectedHour < 23 ? selectedHour + 1 : 0;
                    setSelectedHour(newHour);
                  }}
                >
                  <Ionicons name="add" size={16} color="#007AFF" />
                </TouchableOpacity>
                
                <Text style={styles.timeSeparator}>:</Text>
                
                {/* Bouton - pour les minutes */}
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => {
                    const newMinute = selectedMinute > 0 ? selectedMinute - 1 : 59;
                    setSelectedMinute(newMinute);
                  }}
                >
                  <Ionicons name="remove" size={16} color="#007AFF" />
                </TouchableOpacity>
                
                <TextInput
                  style={styles.timeInput}
                  value={selectedMinute.toString().padStart(2, '0')}
                  onChangeText={(text) => {
                    // Nettoyer le texte pour ne garder que les chiffres
                    const cleanText = text.replace(/[^0-9]/g, '');
                    
                    if (cleanText === '') {
                      setSelectedMinute(0);
                      return;
                    }
                    
                    const minute = parseInt(cleanText);
                    if (!isNaN(minute)) {
                      // Limiter à 59 maximum
                      const validMinute = Math.min(minute, 59);
                      setSelectedMinute(validMinute);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={2}
                  selectTextOnFocus={true}
                />
                
                {/* Bouton + pour les minutes */}
                <TouchableOpacity
                  style={styles.timeButton}
                  onPress={() => {
                    const newMinute = selectedMinute < 59 ? selectedMinute + 1 : 0;
                    setSelectedMinute(newMinute);
                  }}
                >
                  <Ionicons name="add" size={16} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Boutons d'action */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmSelection}
              >
                <Text style={styles.confirmButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  } as any,
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40, // Extra padding pour éviter les zones de sécurité
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  } as any,
  scrollContainer: {
    flex: 1,
  } as any,
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  } as any,
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  } as any,
  closeButton: {
    padding: 5,
  } as any,
  calendarContainer: {
    width: '100%',
    paddingBottom: 20,
  } as any,
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  } as any,
  navButton: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  } as any,
  monthYearContainer: {
    flex: 1,
    alignItems: 'center',
  } as any,
  monthYearText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  } as any,
  dayNamesContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  } as any,
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
    paddingVertical: 8,
  } as any,
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  } as any,
  dayButton: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
  } as any,
  emptyDay: {
    backgroundColor: 'transparent',
  } as any,
  selectedDay: {
    backgroundColor: '#007AFF',
  } as any,
  todayDay: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#007AFF',
  } as any,
  dayText: {
    fontSize: 16,
    color: '#1C1C1E',
  } as any,
  selectedDayText: {
    color: 'white',
    fontWeight: '600',
  } as any,
  todayDayText: {
    color: '#007AFF',
    fontWeight: '600',
  } as any,
  
  // Styles pour la sélection d'heure
  timeSelectionContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  } as any,
  timeSelectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
    textAlign: 'center',
  } as any,
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  } as any,
  timeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E7',
  } as any,
  timeInput: {
    width: 50,
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  } as any,
  timeSeparator: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  } as any,
  
  // Styles pour les boutons d'action
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E7',
  } as any,
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  } as any,
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  } as any,
  confirmButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  } as any,
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  } as any,
};

export default BottomSheetCalendarModal;
