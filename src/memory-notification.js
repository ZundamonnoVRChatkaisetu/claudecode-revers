// Memory notification components from cli.js (lines 1937-1946)

import { Z1 } from './common.js';
import { Xz1 } from './path-utils.js';

const dA1 = Z1(U1(), 1);

// xO2 - Memory update notification component
export function xO2({ memoryType, memoryPath }) {
  const relativePath = Xz1(memoryPath);
  
  return dA1.createElement(
    v,
    { flexDirection: "column", flexGrow: 1 },
    dA1.createElement(
      P,
      { color: "text" },
      Fz1(memoryType),
      " updated in ",
      relativePath,
      " · /memory to edit"
    )
  );
}