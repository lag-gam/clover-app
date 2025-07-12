import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ColorPicker } from 'react-native-color-picker';

const OCCASIONS = [
  'Casual',
  'Work',
  'Date',
  'Party',
  'Formal',
  'Sport',
  'Travel',
  'Other',
];

export default function GenerateOutfitScreen({ navigation }) {
  const [selectedOccasion, setSelectedOccasion] = useState('');
  const [customOccasion, setCustomOccasion] = useState('');
  const [colors, setColors] = useState([]);
  const [colorModalVisible, setColorModalVisible] = useState(false);

  const addColor = (color) => {
    setColors([...colors, color]);
    setColorModalVisible(false);
  };

  const handleOccasionPress = (occ) => {
    setSelectedOccasion(occ);
    if (occ !== 'Other') setCustomOccasion('');
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Generate an Outfit</Text>
        {/* Occasion Prompt */}
        <Text style={styles.label}>What is the occasion?</Text>
        <View style={styles.occasionRow}>
          {OCCASIONS.map((occ) => (
            <TouchableOpacity
              key={occ}
              style={[styles.occasionButton, selectedOccasion === occ && styles.occasionButtonActive]}
              onPress={() => handleOccasionPress(occ)}
            >
              <Text style={[styles.occasionText, selectedOccasion === occ && styles.occasionTextActive]}>{occ}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Custom Occasion Input */}
        {selectedOccasion === 'Other' && (
          <TextInput
            style={styles.customOccasionInput}
            placeholder="Type your occasion..."
            value={customOccasion}
            onChangeText={text => {
              setCustomOccasion(text);
              setSelectedOccasion(text ? text : 'Other');
            }}
            autoFocus
          />
        )}
        {/* Color Selector */}
        <Text style={styles.label}>Pick your colors</Text>
        <View style={styles.colorRow}>
          {colors.map((color, idx) => (
            <View key={color + idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
          ))}
          <TouchableOpacity style={styles.addColorButton} onPress={() => setColorModalVisible(true)}>
            <Ionicons name="add" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>
        {/* Color Picker Modal (color wheel) */}
        <Modal visible={colorModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Pick a Color</Text>
              <ColorPicker
                onColorSelected={addColor}
                style={{ width: 220, height: 220 }}
                hideSliders={true}
              />
              <TouchableOpacity onPress={() => setColorModalVisible(false)} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Placeholder for future prompts */}
        <Text style={styles.label}>More prompts coming soon...</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#D8EAD2',
  },
  backButton: {
    marginTop: 48,
    marginLeft: 16,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#aac5a0',
    position: 'absolute',
    zIndex: 2,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2E4E1F',
  },
  scrollContent: {
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2E4E1F',
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E4E1F',
    marginBottom: 8,
    marginTop: 24,
  },
  occasionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  occasionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  occasionButtonActive: {
    backgroundColor: '#4CAF50',
  },
  occasionText: {
    color: '#2E4E1F',
    fontWeight: '500',
  },
  occasionTextActive: {
    color: '#fff',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#aac5a0',
    marginRight: 8,
  },
  addColorButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: 280,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#2E4E1F',
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#aac5a0',
    marginTop: 16,
  },
  modalButtonText: {
    color: '#2E4E1F',
    fontWeight: '600',
    fontSize: 16,
  },
  customOccasionInput: {
    backgroundColor: '#fff',
    borderColor: '#aac5a0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#2E4E1F',
    marginBottom: 8,
    marginTop: 4,
  },
});
