import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const categories = ['All', 'Shirt', 'Bottoms', 'Jacket', 'Shoes', 'Accessories'];
const seasons = ['All', 'Summer', 'Fall', 'Winter', 'Spring'];

const ITEM_WIDTH = 180;
const SPACING = 16;

export default function ClosetScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [seasonFilter, setSeasonFilter] = useState('All');
  const [filtersVisible, setFiltersVisible] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      const data = await AsyncStorage.getItem('closet');
      setItems(data ? JSON.parse(data) : []);
    };
    fetchItems();
  }, []);

  const filteredItems = items.filter(item => {
    const categoryMatch = categoryFilter === 'All' || item.category === categoryFilter;
    const seasonMatch = seasonFilter === 'All' || item.season === seasonFilter;
    return categoryMatch && seasonMatch;
  });

  // Separate items for racks
  const clothingRackItems = filteredItems.filter(item => ['Shirt', 'Bottoms', 'Jacket'].includes(item.category));
  const shoeRackItems = filteredItems.filter(item => item.category === 'Shoes');

  return (
    <View style={{ flex: 1, backgroundColor: '#D8EAD2' }}>
      {/* Back Button */}
      <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Your Closet</Text>
      {/* Collapsible Filter Bar */}
      <View style={styles.filterToggleBar}>
        {filtersVisible ? (
          <TouchableOpacity style={styles.toggleButton} onPress={() => setFiltersVisible(false)}>
            <Text style={styles.toggleButtonText}>Hide Filters ▲</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.toggleButton} onPress={() => setFiltersVisible(true)}>
            <Text style={styles.toggleButtonText}>Show Filters ▼</Text>
          </TouchableOpacity>
        )}
      </View>
      {filtersVisible && (
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.filterButton, categoryFilter === cat && styles.filterButtonActive]}
                onPress={() => setCategoryFilter(cat)}
              >
                <Text style={[styles.filterText, categoryFilter === cat && styles.filterTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {seasons.map(season => (
              <TouchableOpacity
                key={season}
                style={[styles.filterButton, seasonFilter === season && styles.filterButtonActive]}
                onPress={() => setSeasonFilter(season)}>
                <Text style={[styles.filterText, seasonFilter === season && styles.filterTextActive]}>{season}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {/* Clothing Rack */}
      {clothingRackItems.length > 0 && (
        <View style={styles.rackSection}>
          <Text style={styles.rackTitle}>Clothing Rack</Text>
          <FlatList
            data={clothingRackItems}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            snapToAlignment="center"
            decelerationRate="fast"
            snapToInterval={ITEM_WIDTH + SPACING}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Image source={{ uri: item.image }} style={styles.cardImage} />
                <Text style={styles.name}>{item.name || 'Unnamed'}</Text>
                <Text style={styles.meta}>{item.category} {item.season ? `| ${item.season}` : ''}</Text>
                {item.favorite && <Text style={styles.favorite}>★ Favorite</Text>}
              </View>
            )}
          />
          {/* Virtual rack bar */}
          <View style={styles.rackBar} />
        </View>
      )}
      {/* Shoe Rack */}
      {shoeRackItems.length > 0 && (
        <View style={styles.rackSection}>
          <Text style={styles.rackTitle}>Shoe Rack</Text>
          <FlatList
            data={shoeRackItems}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            snapToAlignment="center"
            decelerationRate="fast"
            snapToInterval={ITEM_WIDTH + SPACING}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Image source={{ uri: item.image }} style={styles.cardImage} />
                <Text style={styles.name}>{item.name || 'Unnamed'}</Text>
                <Text style={styles.meta}>{item.category} {item.season ? `| ${item.season}` : ''}</Text>
                {item.favorite && <Text style={styles.favorite}>★ Favorite</Text>}
              </View>
            )}
          />
          {/* Virtual shoe rack bar */}
          <View style={styles.shoeRackBar} />
        </View>
      )}
      {/* Empty state if no items at all */}
      {clothingRackItems.length === 0 && shoeRackItems.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items match your filters.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginTop: 32,
    marginBottom: 8,
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
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#2E4E1F',
    marginTop: 0,
    marginBottom: 16,
    textAlign: 'center',
  },
  filterToggleBar: {
    alignItems: 'center',
    marginBottom: 4,
  },
  toggleButton: {
    backgroundColor: '#eaf3e4',
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 2,
  },
  toggleButtonText: {
    color: '#2E4E1F',
    fontWeight: '600',
    fontSize: 15,
  },
  filterBar: {
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#eaf3e4',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#4CAF50',
  },
  filterText: {
    color: '#2E4E1F',
    fontWeight: '500',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#fff',
  },
  rackSection: {
    marginBottom: 32,
  },
  rackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3c563a',
    marginLeft: 24,
    marginBottom: 8,
  },
  rackBar: {
    height: 6,
    backgroundColor: '#bdbdbd',
    borderRadius: 3,
    marginHorizontal: 32,
    marginTop: 8,
    marginBottom: 0,
  },
  shoeRackBar: {
    height: 4,
    backgroundColor: '#888',
    borderRadius: 2,
    marginHorizontal: 48,
    marginTop: 8,
    marginBottom: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#567',
    fontSize: 16,
    marginTop: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 180,
    marginRight: 16,
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardImage: {
    width: 120,
    height: 160,
    resizeMode: 'cover',
    borderRadius: 10,
  },
  name: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#2E4E1F',
  },
  meta: {
    color: '#567',
    fontSize: 14,
    marginTop: 2,
    marginBottom: 4,
  },
  favorite: {
    color: '#ffb300',
    fontWeight: '700',
    fontSize: 14,
  },
});
