import React from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

/**
 * Makes Urbanist the default font for every <Text> and <TextInput>.
 * The default is prepended to the element's own style, so any screen that sets
 * its own fontFamily still wins. Call once, before the first render.
 */
export function applyDefaultFont(fontFamily = 'Urbanist-Regular') {
  for (const Component of [Text, TextInput] as any[]) {
    const originalRender = Component.render;
    if (!originalRender || Component.__defaultFontApplied) continue;
    Component.render = function render(...args: any[]) {
      const element = originalRender.apply(this, args);
      return React.cloneElement(element, {
        style: StyleSheet.flatten([{ fontFamily }, element.props.style]),
      });
    };
    Component.__defaultFontApplied = true;
  }
}
