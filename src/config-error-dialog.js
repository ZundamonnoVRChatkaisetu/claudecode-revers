import React from 'react';
import { Box, Text } from 'ink';
import { useInput } from 'ink';
import { Select } from './ui-components.js';
import { useCtrlC } from './hooks.js';
import { EmptyComponent } from './empty-component.js';

/**
 * 設定エラーダイアログコンポーネント
 */
export function ConfigErrorDialog({ filePath, errorDescription, onExit, onReset }) {
  // ESCキーでの終了
  useInput((input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  // Ctrl-C、Ctrl-D処理
  const ctrlCState = useCtrlC();

  return (
    <>
      <Box
        flexDirection="column"
        borderColor="error"
        borderStyle="round"
        padding={1}
        width={70}
        gap={1}
      >
        <Text bold>Configuration Error</Text>
        
        <Box flexDirection="column" gap={1}>
          <Text>
            The configuration file at <Text bold>{filePath}</Text> contains invalid JSON.
          </Text>
          <Text>{errorDescription}</Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>Choose an option:</Text>
          <Select
            options={[
              { label: 'Exit and fix manually', value: 'exit' },
              { label: 'Reset with default configuration', value: 'reset' }
            ]}
            onChange={(value) => {
              if (value === 'exit') {
                onExit();
              } else {
                onReset();
              }
            }}
            onCancel={onExit}
          />
        </Box>
      </Box>

      {ctrlCState.pending ? (
        <Text dimColor>Press {ctrlCState.keyName} again to exit</Text>
      ) : (
        <EmptyComponent />
      )}
    </>
  );
}

/**
 * 設定エラーを表示して処理
 */
export async function showConfigError({ error }) {
  const { render } = await import('ink');
  const { AppStateProvider } = await import('./app-state.js');
  const fs = await import('fs');

  const renderOptions = {
    exitOnCtrlC: false,
    theme: 'dark'
  };

  await new Promise((resolve) => {
    const { unmount } = render(
      <AppStateProvider>
        <ConfigErrorDialog
          filePath={error.filePath}
          errorDescription={error.message}
          onExit={() => {
            unmount();
            resolve();
            process.exit(1);
          }}
          onReset={() => {
            fs.writeFileSync(error.filePath, JSON.stringify(error.defaultConfig, null, 2), {
              flush: false,
              encoding: 'utf8'
            });
            unmount();
            resolve();
            process.exit(0);
          }}
        />
      </AppStateProvider>,
      renderOptions
    );
  });
}