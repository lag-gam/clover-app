// screens/AddItemFlowScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  Button,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const categories = ['Shirt', 'Bottoms', 'Jacket', 'Shoes', 'Accessories'];
const seasons = ['Summer', 'Fall', 'Winter', 'Spring'];

export default function AddItemFlowScreen({ navigation }) {
  const [image, setImage] = useState(null);
  const [name, setName] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const saveItem = async () => {
    if (!image || !selectedCategory) {
      Alert.alert('Missing Info', 'Please select image and category');
      return;
    }
    const item = {
      id: Date.now().toString(),
      image,
      name,
      favorite,
      season: selectedSeason,
      category: selectedCategory,
    };
    try {
      const existing = await AsyncStorage.getItem('closet');
      const closet = existing ? JSON.parse(existing) : [];
      closet.push(item);
      await AsyncStorage.setItem('closet', JSON.stringify(closet));
      Alert.alert('Saved!', 'Item added to closet ✅');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save item');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#D8EAD2' }}>
    <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
  <Text style={styles.backButtonText}>← Back</Text>
</TouchableOpacity>
      <Text style={styles.title}>Add New Clothing Item</Text>
      <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <Text style={styles.imagePlaceholder}>Pick an Image</Text>
        )}
      </TouchableOpacity>

      <TextInput
        placeholder="Name (optional)"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <Text style={styles.label}>Season</Text>
      <View style={styles.row}>
        {seasons.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.tag, selectedSeason === s && styles.selectedTag]}
            onPress={() => setSelectedSeason(s)}
          >
            <Text style={styles.tagText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Category *</Text>
      <View style={styles.row}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.tag, selectedCategory === c && styles.selectedTag]}
            onPress={() => setSelectedCategory(c)}
          >
            <Text style={styles.tagText}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.favoriteButton, favorite && styles.favoriteActive]}
        onPress={() => setFavorite(!favorite)}
      >
        <Text style={styles.favoriteText}>{favorite ? '★ Favorited' : '☆ Favorite'}</Text>
      </TouchableOpacity>

      <Button title="Save Item" onPress={saveItem} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: '#D8EAD2',
      padding: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '600',
      color: '#2E4E1F',
      marginBottom: 16,
      textAlign: 'center',
    },
    imagePicker: {
      backgroundColor: '#eaf3e4',
      height: 240,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: '#aac5a0',
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
    },
    imagePlaceholder: {
      color: '#567',
      fontSize: 16,
    },
    input: {
      backgroundColor: '#fff',
      borderColor: '#aac5a0',
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
      fontSize: 16,
      color: '#2E4E1F',
    },
    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
      color: '#2E4E1F',
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    tag: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#4CAF50',
      backgroundColor: '#fff',
      marginRight: 8,
      marginBottom: 8,
    },
    selectedTag: {
      backgroundColor: '#4CAF50',
    },
    tagText: {
      color: '#2E4E1F',
      fontWeight: '500',
    },
    favoriteButton: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: '#e0e0e0',
      marginBottom: 24,
    },
    favoriteActive: {
      backgroundColor: '#ffeb3b',
    },
    favoriteText: {
      fontWeight: '600',
      color: '#2E4E1F',
    },
    backButton: {
      marginBottom: 16,
      alignSelf: 'flex-start',
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
    scrollContent: {
        padding: 24,
        paddingBottom: 100, // extra space for scroll
      },
  });  