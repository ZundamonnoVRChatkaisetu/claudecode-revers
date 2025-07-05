import React, { createContext, useContext, useMemo } from 'react';
import { Box, Text } from 'ink';
import { figures } from './figures.js';
import { useTheme } from './ui-theme.js';

// デフォルトマーカー
const defaultMarker = figures.line;

// マーカーコンテキスト
const MarkerContext = createContext({ marker: defaultMarker });

// 深さコンテキスト
const DepthContext = createContext({ depth: 0 });

/**
 * UnorderedListアイテムコンポーネント
 */
function UnorderedListItem({ children }) {
  const { marker } = useContext(MarkerContext);
  const { styles } = useTheme('UnorderedList');
  
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
 * UnorderedListコンポーネント
 */
export function UnorderedList({ children }) {
  const { depth } = useContext(DepthContext);
  const { styles, config } = useTheme('UnorderedList');
  
  // 深さコンテキストを更新
  const newDepthValue = useMemo(() => ({
    depth: depth + 1
  }), [depth]);
  
  // マーカーを決定
  const markerValue = useMemo(() => {
    const { marker } = config();
    
    if (typeof marker === 'string') {
      return { marker };
    }
    
    if (Array.isArray(marker)) {
      return { marker: marker[depth] ?? marker.at(-1) ?? defaultMarker };
    }
    
    return { marker: defaultMarker };
  }, [config, depth]);
  
  return (
    <DepthContext.Provider value={newDepthValue}>
      <MarkerContext.Provider value={markerValue}>
        <Box {...styles.list()}>
          {children}
        </Box>
      </MarkerContext.Provider>
    </DepthContext.Provider>
  );
}

UnorderedList.Item = UnorderedListItem;