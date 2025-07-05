import React, { useReducer, useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import { isDeepStrictEqual } from 'node:util';
import { figures } from './figures.js';
import { useTheme } from './ui-theme.js';

// 選択肢のLinkedList実装
class OptionLinkedList extends Map {
  first;
  
  constructor(options) {
    const entries = [];
    let first, previous;
    let index = 0;
    
    for (const option of options) {
      const node = {
        ...option,
        previous,
        next: undefined,
        index
      };
      
      if (previous) {
        previous.next = node;
      }
      
      first ||= node;
      entries.push([option.value, node]);
      index++;
      previous = node;
    }
    
    super(entries);
    this.first = first;
  }
}

// MultiSelectリデューサー
const multiSelectReducer = (state, action) => {
  switch (action.type) {
    case 'focus-next-option': {
      if (!state.focusedValue) return state;
      
      const currentOption = state.optionMap.get(state.focusedValue);
      if (!currentOption) return state;
      
      const nextOption = currentOption.next;
      if (!nextOption) return state;
      
      // スクロール処理
      if (!(nextOption.index >= state.visibleToIndex)) {
        return { ...state, focusedValue: nextOption.value };
      }
      
      const newVisibleTo = Math.min(state.optionMap.size, state.visibleToIndex + 1);
      const newVisibleFrom = newVisibleTo - state.visibleOptionCount;
      
      return {
        ...state,
        focusedValue: nextOption.value,
        visibleFromIndex: newVisibleFrom,
        visibleToIndex: newVisibleTo
      };
    }
    
    case 'focus-previous-option': {
      if (!state.focusedValue) return state;
      
      const currentOption = state.optionMap.get(state.focusedValue);
      if (!currentOption) return state;
      
      const previousOption = currentOption.previous;
      if (!previousOption) return state;
      
      // スクロール処理
      if (!(previousOption.index <= state.visibleFromIndex)) {
        return { ...state, focusedValue: previousOption.value };
      }
      
      const newVisibleFrom = Math.max(0, state.visibleFromIndex - 1);
      const newVisibleTo = newVisibleFrom + state.visibleOptionCount;
      
      return {
        ...state,
        focusedValue: previousOption.value,
        visibleFromIndex: newVisibleFrom,
        visibleToIndex: newVisibleTo
      };
    }
    
    case 'toggle-focused-option': {
      if (!state.focusedValue) return state;
      
      if (state.value.includes(state.focusedValue)) {
        const newValues = new Set(state.value);
        newValues.delete(state.focusedValue);
        
        return {
          ...state,
          previousValue: state.value,
          value: [...newValues]
        };
      }
      
      return {
        ...state,
        previousValue: state.value,
        value: [...state.value, state.focusedValue]
      };
    }
    
    case 'reset':
      return action.state;
      
    default:
      return state;
  }
};

// 初期状態生成
const createInitialState = ({ visibleOptionCount, defaultValue, options }) => {
  const actualVisibleCount = typeof visibleOptionCount === 'number'
    ? Math.min(visibleOptionCount, options.length)
    : options.length;
  
  const optionMap = new OptionLinkedList(options);
  const value = defaultValue ?? [];
  
  return {
    optionMap,
    visibleOptionCount: actualVisibleCount,
    focusedValue: optionMap.first?.value,
    visibleFromIndex: 0,
    visibleToIndex: actualVisibleCount,
    previousValue: value,
    value
  };
};

// MultiSelectフック
const useMultiSelect = ({ visibleOptionCount = 5, options, defaultValue, onChange, onSubmit }) => {
  const [state, dispatch] = useReducer(
    multiSelectReducer,
    { visibleOptionCount, defaultValue, options },
    createInitialState
  );
  
  const [previousOptions, setPreviousOptions] = useState(options);
  
  // オプションが変更された場合の処理
  if (options !== previousOptions && !isDeepStrictEqual(options, previousOptions)) {
    dispatch({
      type: 'reset',
      state: createInitialState({ visibleOptionCount, defaultValue, options })
    });
    setPreviousOptions(options);
  }
  
  // アクション
  const focusNextOption = useCallback(() => {
    dispatch({ type: 'focus-next-option' });
  }, []);
  
  const focusPreviousOption = useCallback(() => {
    dispatch({ type: 'focus-previous-option' });
  }, []);
  
  const toggleFocusedOption = useCallback(() => {
    dispatch({ type: 'toggle-focused-option' });
  }, []);
  
  const submit = useCallback(() => {
    onSubmit?.(state.value);
  }, [state.value, onSubmit]);
  
  // 表示オプション
  const visibleOptions = useMemo(() => {
    return options
      .map((option, index) => ({ ...option, index }))
      .slice(state.visibleFromIndex, state.visibleToIndex);
  }, [options, state.visibleFromIndex, state.visibleToIndex]);
  
  // 値変更の通知
  useEffect(() => {
    if (!isDeepStrictEqual(state.previousValue, state.value)) {
      onChange?.(state.value);
    }
  }, [state.previousValue, state.value, options, onChange]);
  
  return {
    focusedValue: state.focusedValue,
    visibleFromIndex: state.visibleFromIndex,
    visibleToIndex: state.visibleToIndex,
    value: state.value,
    visibleOptions,
    focusNextOption,
    focusPreviousOption,
    toggleFocusedOption,
    submit
  };
};

// キーボード入力フック
const useMultiSelectInput = ({ isDisabled = false, state }) => {
  useInput((input, key) => {
    if (key.downArrow) {
      state.focusNextOption();
    }
    if (key.upArrow) {
      state.focusPreviousOption();
    }
    if (input === ' ') {
      state.toggleFocusedOption();
    }
    if (key.return) {
      state.submit();
    }
  }, { isActive: !isDisabled });
};

/**
 * MultiSelectオプションコンポーネント
 */
function MultiSelectOption({ isFocused, isSelected, children }) {
  const { styles } = useTheme('MultiSelect');
  
  return (
    <Box {...styles.option({ isFocused })}>
      {isFocused && <Text {...styles.focusIndicator()}>{figures.pointer}</Text>}
      <Text {...styles.label({ isFocused, isSelected })}>{children}</Text>
      {isSelected && <Text {...styles.selectedIndicator()}>{figures.tick}</Text>}
    </Box>
  );
}

/**
 * MultiSelectコンポーネント
 */
export function MultiSelect({
  isDisabled = false,
  visibleOptionCount = 5,
  highlightText,
  options,
  defaultValue,
  onChange,
  onSubmit
}) {
  const state = useMultiSelect({
    visibleOptionCount,
    options,
    defaultValue,
    onChange,
    onSubmit
  });
  
  useMultiSelectInput({ isDisabled, state });
  
  const { styles } = useTheme('MultiSelect');
  
  return (
    <Box {...styles.container()}>
      {state.visibleOptions.map((option) => {
        let label = option.label;
        
        // テキストハイライト
        if (highlightText && option.label.includes(highlightText)) {
          const index = option.label.indexOf(highlightText);
          label = (
            <>
              {option.label.slice(0, index)}
              <Text {...styles.highlightedText()}>{highlightText}</Text>
              {option.label.slice(index + highlightText.length)}
            </>
          );
        }
        
        return (
          <MultiSelectOption
            key={option.value}
            isFocused={!isDisabled && state.focusedValue === option.value}
            isSelected={state.value.includes(option.value)}
          >
            {label}
          </MultiSelectOption>
        );
      })}
    </Box>
  );
}