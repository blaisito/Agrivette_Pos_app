import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import RatesManagementComponent from './RatesManagementComponent';
import TablesManagementComponent from './TablesManagementComponent';
import UsersManagementComponent from './UsersManagementComponent';

// Composant Paramètres
const SettingsComponent = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768;
  
  const [activeSection, setActiveSection] = useState('tables');

  // Sections disponibles
  const sections = [
    { key: 'tables', label: 'Gestion des tables', icon: 'restaurant' },
    { key: 'users', label: 'Gestion des utilisateurs', icon: 'people' },
    { key: 'rates', label: 'Gestion des taux', icon: 'trending-up' }
  ];

  // Rendu de la section Tables
  const renderTablesSection = () => <TablesManagementComponent />;

  // Rendu de la section Utilisateurs
  const renderUsersSection = () => <UsersManagementComponent />;

  // Rendu de la section Taux
  const renderRatesSection = () => <RatesManagementComponent />;

  // Rendu du contenu selon la section active
  const renderActiveContent = () => {
    switch (activeSection) {
      case 'tables':
        return renderTablesSection();
      case 'users':
        return renderUsersSection();
      case 'rates':
        return renderRatesSection();
      default:
        return renderTablesSection();
    }
  };

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <View style={styles.container}>
        <View style={styles.headerWeb}>
          <Text style={styles.headerTitleWeb}>Paramètres</Text>
          <Text style={styles.headerSubtitleWeb}>Gestion des configurations du système</Text>
        </View>
        
        <View style={styles.contentWeb}>
          {/* Sidebar avec les sections */}
          <View style={styles.sidebarWeb}>
            {sections.map((section) => (
              <TouchableOpacity
                key={section.key}
                style={[
                  styles.sidebarItemWeb,
                  activeSection === section.key && styles.sidebarItemActiveWeb
                ]}
                onPress={() => setActiveSection(section.key)}
              >
                <Ionicons 
                  name={section.icon as any} 
                  size={20} 
                  color={activeSection === section.key ? '#FFFFFF' : '#6B7280'} 
                />
                <Text style={[
                  styles.sidebarItemTextWeb,
                  activeSection === section.key && styles.sidebarItemTextActiveWeb
                ]}>
                  {section.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Contenu principal */}
          <View style={styles.mainContentWeb}>
            {renderActiveContent()}
          </View>
        </View>
      </View>
    );
  }

  // Version Mobile/Tablet - Modern Design
  return (
    <View style={styles.containerModernMobile}>
      {/* Navigation moderne des sections */}
      <View style={styles.tabsWrapperMobile}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContentMobile}
        >
          {sections.map((section) => (
            <TouchableOpacity
              key={section.key}
              style={[
                styles.modernTabMobile,
                activeSection === section.key && styles.modernTabActiveMobile
              ]}
              onPress={() => setActiveSection(section.key)}
            >
              <Ionicons 
                name={section.icon as any} 
                size={18} 
                color={activeSection === section.key ? '#FFFFFF' : '#7C3AED'} 
              />
              <Text style={[
                styles.modernTabTextMobile,
                activeSection === section.key && styles.modernTabTextActiveMobile
              ]}>
                {section.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Contenu principal */}
      <ScrollView style={styles.mainContentModernMobile} showsVerticalScrollIndicator={false}>
        {renderActiveContent()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // Container principal
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  
  // Header Web
  headerWeb: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitleWeb: {
    fontSize: 14,
    color: '#64748B',
  },
  
  // Header Mobile
  headerMobile: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  headerSubtitleMobile: {
    fontSize: 12,
    color: '#64748B',
  },
  
  // Content Web
  contentWeb: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebarWeb: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    paddingVertical: 20,
  },
  sidebarItemWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  sidebarItemActiveWeb: {
    backgroundColor: '#3B82F6',
  },
  sidebarItemTextWeb: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
    fontWeight: '500',
  },
  sidebarItemTextActiveWeb: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mainContentWeb: {
    flex: 1,
  },
  
  // Content Mobile
  sectionTabsMobile: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionTabsContentMobile: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTabMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  sectionTabActiveMobile: {
    backgroundColor: '#3B82F6',
  },
  sectionTabTextMobile: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  sectionTabTextActiveMobile: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mainContentMobile: {
    flex: 1,
  },

  // Modern Mobile Styles
  containerModernMobile: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerModernMobile: {
    backgroundColor: '#FFFFFF',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitleModernMobile: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSubtitleModernMobile: {
    fontSize: 13,
    color: '#6B7280',
  },
  tabsWrapperMobile: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
    elevation: 1,
  },
  tabsScrollContentMobile: {
    paddingHorizontal: 16,
    gap: 8,
  },
  modernTabMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  modernTabActiveMobile: {
    backgroundColor: '#7C3AED',
  },
  modernTabTextMobile: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '600',
  },
  modernTabTextActiveMobile: {
    color: '#FFFFFF',
  },
  mainContentModernMobile: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});

export default SettingsComponent;
