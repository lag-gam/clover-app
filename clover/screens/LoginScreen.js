import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) return Alert.alert('Missing fields');

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) Alert.alert('Auth Error', error.message);
    else Alert.alert(isSignUp ? 'Check your email to confirm account.' : 'Welcome back!');
  };

  return (
    <View style={styles.container}>
      <Image
  source={require('../assets/clover.jpeg')}
  style={{ width: 200, height: 100, marginBottom: 32 }}
  resizeMode="contain"
/>

      <Text style={styles.title}>
        {isSignUp ? 'Sign Up for Clover' : 'Welcome to Clover'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholderTextColor="#567"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#567"
      />

      <TouchableOpacity style={styles.button} onPress={handleAuth}>
        <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Log In'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.toggleText}>
          {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D8EAD2', // soft sage
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    width: 50,
    height:500,
    resizeMode: 'contain',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#2E4E1F',
    marginBottom: 24,
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    borderColor: '#aac5a0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    color: '#333',
  },
  button: {
    width: '100%',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleText: {
    color: '#3c563a',
    marginTop: 10,
    fontSize: 14,
    opacity: 0.8,
  },
});
