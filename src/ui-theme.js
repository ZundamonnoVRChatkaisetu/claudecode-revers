import React, { createContext, useContext } from 'react';
import { figures } from './figures.js';

// デフォルトのスタイル設定
const defaultStyles = {
  Alert: {
    styles: {
      container: ({ variant }) => ({
        flexGrow: 1,
        borderStyle: 'round',
        borderColor: variantColors[variant],
        gap: 1,
        paddingX: 1
      }),
      iconContainer: () => ({
        flexShrink: 0
      }),
      icon: ({ variant }) => ({
        color: variantColors[variant]
      }),
      content: () => ({
        flexShrink: 1,
        flexGrow: 1,
        minWidth: 0,
        flexDirection: 'column',
        gap: 1
      }),
      title: () => ({
        bold: true
      }),
      message: () => ({})
    },
    config({ variant }) {
      let icon;
      if (variant === 'info') icon = figures.info;
      if (variant === 'success') icon = figures.tick;
      if (variant === 'error') icon = figures.cross;
      if (variant === 'warning') icon = figures.warning;
      return { icon };
    }
  },
  
  Badge: {
    styles: {
      container: ({ color }) => ({
        backgroundColor: color
      }),
      label: () => ({
        color: 'black'
      })
    }
  },
  
  ConfirmInput: {
    styles: {
      input: ({ isFocused }) => ({
        dimColor: !isFocused
      })
    }
  },
  
  MultiSelect: {
    styles: {
      container: () => ({
        flexDirection: 'column'
      }),
      option: ({ isFocused }) => ({
        gap: 1,
        paddingLeft: isFocused ? 0 : 2
      }),
      selectedIndicator: () => ({
        color: 'green'
      }),
      focusIndicator: () => ({
        color: 'blue'
      }),
      label({ isFocused, isSelected }) {
        let color;
        if (isSelected) color = 'green';
        if (isFocused) color = 'blue';
        return { color };
      },
      highlightedText: () => ({
        bold: true
      })
    }
  },
  
  OrderedList: {
    styles: {
      list: () => ({
        flexDirection: 'column'
      }),
      listItem: () => ({
        gap: 1
      }),
      marker: () => ({
        dimColor: true
      }),
      content: () => ({
        flexDirection: 'column'
      })
    }
  },
  
  ProgressBar: {
    styles: {
      container: () => ({
        flexGrow: 1,
        minWidth: 0
      }),
      completed: () => ({
        color: 'magenta'
      }),
      remaining: () => ({
        dimColor: true
      })
    },
    config: () => ({
      completedCharacter: figures.square,
      remainingCharacter: figures.squareLightShade
    })
  },
  
  Select: {
    styles: {
      container: () => ({
        flexDirection: 'column'
      }),
      option: ({ isFocused }) => ({
        gap: 1,
        paddingLeft: isFocused ? 0 : 2
      }),
      selectedIndicator: () => ({
        color: 'green'
      }),
      focusIndicator: () => ({
        color: 'blue'
      }),
      label({ isFocused, isSelected }) {
        let color;
        if (isSelected) color = 'green';
        if (isFocused) color = 'blue';
        return { color };
      },
      highlightedText: () => ({
        bold: true
      })
    }
  },
  
  Spinner: {
    styles: {
      container: () => ({
        gap: 1
      }),
      frame: () => ({
        color: 'blue'
      }),
      label: () => ({})
    }
  },
  
  StatusMessage: {
    styles: {
      container: () => ({
        gap: 1
      }),
      iconContainer: () => ({
        flexShrink: 0
      }),
      icon: ({ variant }) => ({
        color: variantColors[variant]
      }),
      message: () => ({})
    },
    config: ({ variant }) => ({
      icon: variantIcons[variant]
    })
  },
  
  UnorderedList: {
    styles: {
      list: () => ({
        flexDirection: 'column'
      }),
      listItem: () => ({
        gap: 1
      }),
      marker: () => ({
        dimColor: true
      }),
      content: () => ({
        flexDirection: 'column'
      })
    },
    config: () => ({
      marker: figures.line
    })
  },
  
  TextInput: {
    styles: {
      value: () => ({})
    }
  },
  
  EmailInput: {
    styles: {
      value: () => ({})
    }
  },
  
  PasswordInput: {
    styles: {
      value: () => ({})
    }
  }
};

// バリアントカラー
const variantColors = {
  info: 'blue',
  success: 'green',
  error: 'red',
  warning: 'yellow'
};

// バリアントアイコン
const variantIcons = {
  success: figures.tick,
  error: figures.cross,
  warning: figures.warning,
  info: figures.info
};

// テーマコンテキスト
const ThemeContext = createContext({
  components: defaultStyles
});

/**
 * UIコンポーネントのスタイルとコンフィグを取得
 */
export const useTheme = (componentName) => {
  return useContext(ThemeContext).components[componentName];
};