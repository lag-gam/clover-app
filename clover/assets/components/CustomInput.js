import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';

export default function CustomInput({ value, onChangeText, placeholder, secureTextEntry, style }) {
  return (
    <TextInput
      style={[styles.input, style]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#777"
      secureTextEntry={secureTextEntry}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    width: '100%',
    backgroundColor: '#fff',
    borderColor: Colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    fontFamily: Fonts.body,
    color: Colors.text,
  },
});
