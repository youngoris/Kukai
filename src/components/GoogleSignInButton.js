import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import googleSignInService from '../services/auth/GoogleSignInService';

const GoogleSignInButton = ({ onSignInSuccess, onSignInFailure, buttonText = 'Sign in with Google' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      
      // Initialize Google Sign-in if needed
      await googleSignInService.initialize();
      
      // Perform sign-in
      const result = await googleSignInService.signIn();
      
      if (result.success) {
        setUser(result.user);
        if (onSignInSuccess) {
          onSignInSuccess(result.user);
        }
      } else {
        console.log('Sign-in failed:', result.error);
        if (onSignInFailure) {
          onSignInFailure(result.error);
        }
      }
    } catch (error) {
      console.error('Sign-in error:', error);
      if (onSignInFailure) {
        onSignInFailure(error.message || 'An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await googleSignInService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign-out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.button}>
        <ActivityIndicator color="#fff" size="small" />
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.container}>
        <Text style={styles.userInfo}>Signed in as: {user.email}</Text>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.button} onPress={handleSignIn}>
      <Text style={styles.buttonText}>{buttonText}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#DB4437',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  userInfo: {
    marginBottom: 8,
    fontSize: 14,
  },
});

export default GoogleSignInButton; 