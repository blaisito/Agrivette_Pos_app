import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TabTwoScreen() {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768; // Tablette = 768px, donc > 768px = desktop/large screen

  // Données de l'utilisateur connecté
  const userData = {
    name: 'Jean Dupont',
    email: 'jean.dupont@restaurant.com',
    role: 'Gestionnaire',
    phone: '+33 6 12 34 56 78',
    joinDate: '15 Janvier 2023',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
    restaurant: 'Restaurant Manager Pro',
    location: 'Paris, France'
  };

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <View style={styles.containerWeb}>
        {/* Background Image */}
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' }}
          style={styles.backgroundImageWeb}
        />
        
        {/* Overlay */}
        <View style={styles.overlayWeb} />
        
        {/* User Profile Card */}
        <View style={styles.profileCardWeb}>
          <ScrollView style={styles.scrollViewWeb}>
            {/* Header de la carte */}
            <View style={styles.cardHeaderWeb}>
              <View style={styles.avatarContainerWeb}>
                <Image
                  source={{ uri: userData.avatar }}
                  style={styles.avatarWeb}
                />
                <TouchableOpacity style={styles.editAvatarButtonWeb}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.userInfoWeb}>
                <Text style={styles.userNameWeb}>{userData.name}</Text>
                <Text style={styles.userRoleWeb}>{userData.role}</Text>
                <Text style={styles.userRestaurantWeb}>{userData.restaurant}</Text>
              </View>
              <TouchableOpacity style={styles.editButtonWeb}>
                <Ionicons name="create-outline" size={20} color="#7C3AED" />
                <Text style={styles.editButtonTextWeb}>Modifier</Text>
              </TouchableOpacity>
            </View>

            {/* Informations détaillées */}
            <View style={styles.detailsSectionWeb}>
              <Text style={styles.sectionTitleWeb}>Informations personnelles</Text>
              
              <View style={styles.infoRowWeb}>
                <View style={styles.infoIconWeb}>
                  <Ionicons name="mail-outline" size={20} color="#7C3AED" />
                </View>
                <View style={styles.infoContentWeb}>
                  <Text style={styles.infoLabelWeb}>Email</Text>
                  <Text style={styles.infoValueWeb}>{userData.email}</Text>
                </View>
              </View>

              <View style={styles.infoRowWeb}>
                <View style={styles.infoIconWeb}>
                  <Ionicons name="call-outline" size={20} color="#7C3AED" />
                </View>
                <View style={styles.infoContentWeb}>
                  <Text style={styles.infoLabelWeb}>Téléphone</Text>
                  <Text style={styles.infoValueWeb}>{userData.phone}</Text>
                </View>
              </View>

              <View style={styles.infoRowWeb}>
                <View style={styles.infoIconWeb}>
                  <Ionicons name="location-outline" size={20} color="#7C3AED" />
                </View>
                <View style={styles.infoContentWeb}>
                  <Text style={styles.infoLabelWeb}>Localisation</Text>
                  <Text style={styles.infoValueWeb}>{userData.location}</Text>
                </View>
              </View>

              <View style={styles.infoRowWeb}>
                <View style={styles.infoIconWeb}>
                  <Ionicons name="calendar-outline" size={20} color="#7C3AED" />
                </View>
                <View style={styles.infoContentWeb}>
                  <Text style={styles.infoLabelWeb}>Membre depuis</Text>
                  <Text style={styles.infoValueWeb}>{userData.joinDate}</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsSectionWeb}>
              <TouchableOpacity style={styles.actionButtonWeb}>
                <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonTextWeb}>Paramètres</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButtonWeb}>
                <Ionicons name="help-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.actionButtonTextWeb}>Aide</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutButtonWeb}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={styles.logoutButtonTextWeb}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Version Mobile/Tablet
  return (
    <View style={styles.containerMobile}>
      {/* Background Image */}
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' }}
        style={styles.backgroundImageMobile}
      />
      
      {/* Overlay */}
      <View style={styles.overlayMobile} />
      
      {/* User Profile Card */}
      <View style={styles.profileCardMobile}>
        <ScrollView style={styles.scrollViewMobile}>
          {/* Header de la carte */}
          <View style={styles.cardHeaderMobile}>
            <View style={styles.avatarContainerMobile}>
              <Image
                source={{ uri: userData.avatar }}
                style={styles.avatarMobile}
              />
              <TouchableOpacity style={styles.editAvatarButtonMobile}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.userInfoMobile}>
              <Text style={styles.userNameMobile}>{userData.name}</Text>
              <Text style={styles.userRoleMobile}>{userData.role}</Text>
              <Text style={styles.userRestaurantMobile}>{userData.restaurant}</Text>
            </View>
            <TouchableOpacity style={styles.editButtonMobile}>
              <Ionicons name="create-outline" size={18} color="#7C3AED" />
              <Text style={styles.editButtonTextMobile}>Modifier</Text>
            </TouchableOpacity>
          </View>

          {/* Informations détaillées */}
          <View style={styles.detailsSectionMobile}>
            <Text style={styles.sectionTitleMobile}>Informations personnelles</Text>
            
            <View style={styles.infoRowMobile}>
              <View style={styles.infoIconMobile}>
                <Ionicons name="mail-outline" size={18} color="#7C3AED" />
              </View>
              <View style={styles.infoContentMobile}>
                <Text style={styles.infoLabelMobile}>Email</Text>
                <Text style={styles.infoValueMobile}>{userData.email}</Text>
              </View>
            </View>

            <View style={styles.infoRowMobile}>
              <View style={styles.infoIconMobile}>
                <Ionicons name="call-outline" size={18} color="#7C3AED" />
              </View>
              <View style={styles.infoContentMobile}>
                <Text style={styles.infoLabelMobile}>Téléphone</Text>
                <Text style={styles.infoValueMobile}>{userData.phone}</Text>
              </View>
            </View>

            <View style={styles.infoRowMobile}>
              <View style={styles.infoIconMobile}>
                <Ionicons name="location-outline" size={18} color="#7C3AED" />
              </View>
              <View style={styles.infoContentMobile}>
                <Text style={styles.infoLabelMobile}>Localisation</Text>
                <Text style={styles.infoValueMobile}>{userData.location}</Text>
              </View>
            </View>

            <View style={styles.infoRowMobile}>
              <View style={styles.infoIconMobile}>
                <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
              </View>
              <View style={styles.infoContentMobile}>
                <Text style={styles.infoLabelMobile}>Membre depuis</Text>
                <Text style={styles.infoValueMobile}>{userData.joinDate}</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsSectionMobile}>
            <TouchableOpacity style={styles.actionButtonMobile}>
              <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonTextMobile}>Paramètres</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButtonMobile}>
              <Ionicons name="help-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonTextMobile}>Aide</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButtonMobile}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text style={styles.logoutButtonTextMobile}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Container Web
  containerWeb: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  backgroundImageWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    width: '100%',
  },
  overlayWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  profileCardWeb: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    bottom: '5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollViewWeb: {
    flex: 1,
    padding: 24,
  },
  cardHeaderWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainerWeb: {
    position: 'relative',
    marginRight: 20,
  },
  avatarWeb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#7C3AED',
  },
  editAvatarButtonWeb: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoWeb: {
    flex: 1,
  },
  userNameWeb: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userRoleWeb: {
    fontSize: 16,
    color: '#7C3AED',
    fontWeight: '600',
    marginBottom: 2,
  },
  userRestaurantWeb: {
    fontSize: 14,
    color: '#6B7280',
  },
  editButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7C3AED',
    gap: 6,
  },
  editButtonTextWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7C3AED',
  },
  detailsSectionWeb: {
    marginBottom: 32,
  },
  sectionTitleWeb: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
  },
  infoRowWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  infoIconWeb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContentWeb: {
    flex: 1,
  },
  infoLabelWeb: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValueWeb: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  actionsSectionWeb: {
    gap: 12,
  },
  actionButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    gap: 8,
  },
  actionButtonTextWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  logoutButtonWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 8,
  },
  logoutButtonTextWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },

  // Container Mobile
  containerMobile: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  backgroundImageMobile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    width: '100%',
  },
  overlayMobile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  profileCardMobile: {
    position: 'absolute',
    top: '20%',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollViewMobile: {
    flex: 1,
    padding: 20,
  },
  cardHeaderMobile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainerMobile: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarMobile: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#7C3AED',
  },
  editAvatarButtonMobile: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoMobile: {
    alignItems: 'center',
    marginBottom: 16,
  },
  userNameMobile: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userRoleMobile: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '600',
    marginBottom: 2,
  },
  userRestaurantMobile: {
    fontSize: 12,
    color: '#6B7280',
  },
  editButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#7C3AED',
    gap: 4,
  },
  editButtonTextMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7C3AED',
  },
  detailsSectionMobile: {
    marginBottom: 24,
  },
  sectionTitleMobile: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  infoRowMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 6,
  },
  infoIconMobile: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContentMobile: {
    flex: 1,
  },
  infoLabelMobile: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValueMobile: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  actionsSectionMobile: {
    gap: 8,
  },
  actionButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#7C3AED',
    gap: 6,
  },
  actionButtonTextMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  logoutButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 6,
  },
  logoutButtonTextMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
