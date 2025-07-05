import React, { createContext, useContext, Children, isValidElement } from 'react';
import { Box, Text } from 'ink';
import { figures } from './figures.js';
import { useTheme } from './ui-theme.js';

// マーカーコンテキスト
const MarkerContext = createContext({ marker: figures.line });
const DepthMarkerContext = createContext({ marker: '' });

/**
 * OrderedListアイテムコンポーネント
 */
export function OrderedListItem({ children }) {
  const { marker } = useContext(MarkerContext);
  const { styles } = useTheme('OrderedList');
  
  return (
    <Box {...styles.listItem()}>
      <Text {...styles.marker()}>{marker}</Text>
      <Box {...styles.content()}>
        {children}
      </Box>
    </Box>
  );
}

/**
 * OrderedListコンポーネント
 */
export function OrderedList({ children }) {
  const { marker: parentMarker } = useContext(DepthMarkerContext);
  const { styles } = useTheme('OrderedList');
  
  // アイテム数をカウント
  let itemCount = 0;
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== OrderedListItem) {
      continue;
    }
    itemCount++;
  }
  
  // 番号の最大桁数を計算
  const maxDigits = String(itemCount).length;
  
  return (
    <Box {...styles.list()}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child) || child.type !== OrderedListItem) {
          return child;
        }
        
        // 番号をフォーマット
        const number = `${String(index + 1).padStart(maxDigits)}.`;
        const fullMarker = `${parentMarker}${number}`;
        
        return (
          <DepthMarkerContext.Provider value={{ marker: fullMarker }}>
            <MarkerContext.Provider value={{ marker: fullMarker }}>
              {child}
            </MarkerContext.Provider>
          </DepthMarkerContext.Provider>
        );
      })}
    </Box>
  );
}

OrderedList.Item = OrderedListItem;