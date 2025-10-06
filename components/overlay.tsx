import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const OverlayLabel = ({ label, color }: { label?: string; color?: string }) => (
  <View style={[styles.overlayLabel, { borderColor: color, backgroundColor: color }]}>
    <Text style={[styles.overlayLabelText, { color: 'white' }]}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlayLabel: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
    borderWidth: 2,
    borderRadius: 10,
  },
  overlayLabelText: {
    fontSize: 25,
    textAlign: 'center',
  },
});
export default OverlayLabel;
