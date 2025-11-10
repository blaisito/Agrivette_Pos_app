import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { loginUser } from '../api/userApi';
import { isUserLoggedIn, storeUserData } from '../utils/storage';

// Page de Login
const LoginScreen = () => {
  const { width } = Dimensions.get('window');
  const isLargeScreen = width > 768; // Tablette = 768px, donc > 768px = desktop/large screen
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);

  // Vérifier si l'utilisateur est déjà connecté au chargement de la page
  useEffect(() => {
    const checkExistingLogin = async () => {
      try {
        const loggedIn = await isUserLoggedIn();
        
        if (loggedIn) {
          router.replace('/(tabs)');
          return;
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de connexion:', error);
      } finally {
        setIsCheckingLogin(false);
      }
    };

    checkExistingLogin();
  }, []);

  const handleLogin = async () => {
    // Validation des champs
    if (!username.trim() || !password.trim()) {
      if (isLargeScreen) {
        window.alert('❌ Erreur : Veuillez remplir tous les champs');
      } else {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      }
      return;
    }

    setIsLoading(true);

    try {
      // Appel de l'API de connexion
      const response = await loginUser(username.trim(), password.trim());

      if (response && response.success) {
        // Stocker les données utilisateur
        const userData = {
          id: response.data.id,
          username: response.data.username,
          depotCode: response.data.depotCode || null,
          claims: response.data.claims || [],
          token: response.data.token || null,
          loginTime: new Date().toISOString()
        };

        const storageSuccess = await storeUserData(userData);
        
        if (storageSuccess) {
          if (isLargeScreen) {
            window.alert('✅ Connexion réussie !');
          } else {
            Alert.alert('Succès', 'Connexion réussie !');
          }
          
          // Navigation vers la page principale
          router.replace('/(tabs)');
        } else {
          if (isLargeScreen) {
            window.alert('❌ Erreur : Impossible de sauvegarder les données de connexion');
          } else {
            Alert.alert('Erreur', 'Impossible de sauvegarder les données de connexion');
          }
        }
      } else {
        if (isLargeScreen) {
          window.alert('❌ Erreur : ' + (response?.message || 'Nom d\'utilisateur ou mot de passe incorrect'));
        } else {
          Alert.alert('Erreur', response?.message || 'Nom d\'utilisateur ou mot de passe incorrect');
        }
      }
    } catch (error) {
      console.error('=== Erreur lors de la connexion ===', error);
      
      if (isLargeScreen) {
        window.alert('❌ Erreur : Problème de connexion au serveur');
      } else {
        Alert.alert('Erreur', 'Problème de connexion au serveur');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour ouvrir le lien LogiqSoft
  const openLogiqSoftLink = async () => {
    try {
      const url = 'https://logiqsoft.io/';
      const supported = await Linking.canOpenURL(url);
      
      if (supported) {
        await Linking.openURL(url);
      } else {
        if (isLargeScreen) {
          window.alert('❌ Impossible d\'ouvrir le lien');
        } else {
          Alert.alert('Erreur', 'Impossible d\'ouvrir le lien');
        }
      }
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du lien:', error);
      if (isLargeScreen) {
        window.alert('❌ Erreur lors de l\'ouverture du lien');
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir le lien');
      }
    }
  };

  // Écran de chargement pendant la vérification de connexion
  if (isCheckingLogin) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Vérification de la connexion...</Text>
        </View>
      </View>
    );
  }

  // Version Desktop/Large Screen
  if (isLargeScreen) {
    return (
      <View style={styles.containerWeb}>
        {/* Background Image */}
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80' }}
          style={styles.backgroundImageWeb}
          resizeMode="cover"
        />
        
        {/* Overlay */}
        <View style={styles.overlayWeb} />
        
        {/* Login Card */}
        <View style={styles.loginCardWeb}>
          <View style={styles.loginHeaderWeb}>
            <View style={styles.logoContainerWeb}>
              <Ionicons name="restaurant" size={40} color="#7C3AED" />
            </View>
            <Text style={styles.loginTitleWeb}>Restaurant Manager</Text>
            <Text style={styles.loginSubtitleWeb}>Connectez-vous à votre compte</Text>
          </View>
          
          <View style={styles.formContainerWeb}>
            <View style={styles.inputGroupWeb}>
              <Text style={styles.inputLabelWeb}>Nom d'utilisateur</Text>
              <View style={styles.inputContainerWeb}>
                <Ionicons name="person" size={20} color="#6B7280" style={styles.inputIconWeb} />
                <TextInput
                  style={styles.textInputWeb}
                  placeholder="Entrez votre nom d'utilisateur"
                  value={username}
                  onChangeText={setUsername}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
              </View>
            </View>
            
            <View style={styles.inputGroupWeb}>
              <Text style={styles.inputLabelWeb}>Mot de passe</Text>
              <View style={styles.inputContainerWeb}>
                <Ionicons name="lock-closed" size={20} color="#6B7280" style={styles.inputIconWeb} />
                <TextInput
                  style={styles.textInputWeb}
                  placeholder="Entrez votre mot de passe"
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIconWeb}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off" : "eye"} 
                    size={20} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity 
              style={[styles.loginButtonWeb, isLoading && styles.disabledButtonWeb]} 
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonTextWeb}>Se connecter</Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.forgotPasswordWeb}>
              <TouchableOpacity onPress={openLogiqSoftLink}>
                <Text style={styles.forgotPasswordTextWeb}>Application construite par LogiqSoft</Text>
              </TouchableOpacity>
            </View>
          </View>
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
        resizeMode="cover"
      />
      
      {/* Overlay */}
      <View style={styles.overlayMobile} />
      
      {/* Login Card */}
      <View style={styles.loginCardMobile}>
        <View style={styles.loginHeaderMobile}>
          <View style={styles.logoContainerMobile}>
            <Ionicons name="restaurant" size={32} color="#7C3AED" />
          </View>
          <Text style={styles.loginTitleMobile}>Restaurant Manager</Text>
          <Text style={styles.loginSubtitleMobile}>Connectez-vous à votre compte</Text>
        </View>
        
        <View style={styles.formContainerMobile}>
          <View style={styles.inputGroupMobile}>
            <Text style={styles.inputLabelMobile}>Nom d'utilisateur</Text>
            <View style={styles.inputContainerMobile}>
              <Ionicons name="person" size={18} color="#6B7280" style={styles.inputIconMobile} />
              <TextInput
                style={styles.textInputMobile}
                placeholder="Entrez votre nom d'utilisateur"
                value={username}
                onChangeText={setUsername}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            </View>
          </View>
          
          <View style={styles.inputGroupMobile}>
            <Text style={styles.inputLabelMobile}>Mot de passe</Text>
            <View style={styles.inputContainerMobile}>
              <Ionicons name="lock-closed" size={18} color="#6B7280" style={styles.inputIconMobile} />
              <TextInput
                style={styles.textInputMobile}
                placeholder="Entrez votre mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeIconMobile}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={18} 
                  color="#6B7280" 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.loginButtonMobile, isLoading && styles.disabledButtonMobile]} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonTextMobile}>Se connecter</Text>
            )}
          </TouchableOpacity>
          
          <View style={styles.forgotPasswordMobile}>
          <TouchableOpacity onPress={openLogiqSoftLink}>
                <Text style={styles.forgotPasswordTextWeb}>Application construite par LogiqSoft</Text>
              </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Container Web
  containerWeb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  backgroundImageWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlayWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  loginCardWeb: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    width: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 1,
  },
  loginHeaderWeb: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainerWeb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loginTitleWeb: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  loginSubtitleWeb: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  formContainerWeb: {
    gap: 24,
  },
  inputGroupWeb: {
    gap: 8,
  },
  inputLabelWeb: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  inputContainerWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 12,
  },
  inputIconWeb: {
    marginRight: 8,
  },
  textInputWeb: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#374151',
  },
  eyeIconWeb: {
    padding: 4,
  },
  loginButtonWeb: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonTextWeb: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  forgotPasswordWeb: {
    alignItems: 'center',
    marginTop: 8,
  },
  forgotPasswordTextWeb: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '500',
  },
  disabledButtonWeb: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },

  // Container Mobile
  containerMobile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 0,
  },
  backgroundImageMobile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  overlayMobile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  loginCardMobile: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  loginHeaderMobile: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainerMobile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  loginTitleMobile: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 6,
  },
  loginSubtitleMobile: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  formContainerMobile: {
    gap: 20,
  },
  inputGroupMobile: {
    gap: 6,
  },
  inputLabelMobile: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  inputContainerMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
  },
  inputIconMobile: {
    marginRight: 6,
  },
  textInputMobile: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#374151',
  },
  eyeIconMobile: {
    padding: 3,
  },
  loginButtonMobile: {
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  loginButtonTextMobile: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  forgotPasswordMobile: {
    alignItems: 'center',
    marginTop: 4,
  },
  forgotPasswordTextMobile: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '500',
  },
  disabledButtonMobile: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },

  // Styles pour l'écran de chargement
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 280,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default LoginScreen;
