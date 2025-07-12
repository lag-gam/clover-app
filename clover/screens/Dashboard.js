import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function DashboardScreen({ navigation }) {
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = useState(new Animated.Value(0))[0];

  const toggleMenu = () => {
    setExpanded(!expanded);
    Animated.timing(scaleAnim, {
      toValue: expanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Discovery Board</Text>

      {/* Floating Menu Options */}
      {expanded && (
        <Animated.View style={[styles.menuOption, { bottom: 110, transform: [{ scale: scaleAnim }] }]}> 
          <TouchableOpacity onPress={() => { toggleMenu(); navigation.navigate('Generate'); }}>
            <Ionicons name="sparkles-outline" size={24} color="#fff" />
            <Text style={styles.menuLabel}>Generate Outfit</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      {expanded && (
        <Animated.View style={[styles.menuOption, { bottom: 180, transform: [{ scale: scaleAnim }] }]}> 
          <TouchableOpacity onPress={() => { toggleMenu(); navigation.navigate('AddItem'); }}>
            <Ionicons name="add-circle-outline" size={24} color="#fff" />
            <Text style={styles.menuLabel}>Add to Closet</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bottom Menu Bar */}
      <View style={styles.menuBar}>
        {/* Home/Discovery */}
        <TouchableOpacity style={styles.menuButton} onPress={() => {}}>
          <Ionicons name="home-outline" size={28} color="#888" />
        </TouchableOpacity>
        {/* Closet */}
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Closet')}>
          <MaterialCommunityIcons name="hanger" size={28} color="#888" />
        </TouchableOpacity>
        {/* Add Item (center, prominent, now toggles floating menu) */}
        <TouchableOpacity style={styles.addButton} onPress={toggleMenu}>
          <Ionicons name={expanded ? 'close' : 'add'} size={32} color="#fff" />
        </TouchableOpacity>
        {/* Avatar/Profile */}
        <TouchableOpacity style={styles.menuButton} onPress={() => {}}>
          <Ionicons name="person-circle-outline" size={28} color="#888" />
        </TouchableOpacity>
        {/* Settings */}
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={28} color="#888" />
        </TouchableOpacity>
      </View>
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
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#2E4E1F',
    marginBottom: 16,
    fontFamily: 'System',
  },
  menuBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#D8EAD2',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: '#aac5a0',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  menuButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  addButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#388E3C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  menuOption: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 24,
    alignItems: 'center',
    zIndex: 10,
    minWidth: 140,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  menuLabel: {
    color: '#fff',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
});

