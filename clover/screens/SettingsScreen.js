import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function SettingsScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.text}>Settings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D8EAD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#aac5a0',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2E4E1F',
  },
  text: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2E4E1F',
  },
}); 