// Jupyter Notebook editor tool from cli.js (lines 1917-1926)

import { Z1 } from './common.js';
import { extname, isAbsolute, relative, resolve } from 'path';

const K7 = Z1(U1(), 1);
const PD = Z1(U1(), 1);

// HO2 - Notebook editor rejection message component
function HO2({ notebook_path, cell_id, new_source, cell_type, edit_mode = "replace", verbose }) {
  const action = edit_mode === "delete" ? "delete" : `${edit_mode} cell in`;
  
  return PD.createElement($0, null,
    PD.createElement(v, { flexDirection: "column" },
      PD.createElement(v, { flexDirection: "row" },
        PD.createElement(P, { color: "error" }, "User rejected ", action, " "),
        PD.createElement(P, { bold: true, color: "error" }, verbose ? notebook_path : qq6(dA(), notebook_path)),
        PD.createElement(P, { color: "error" }, " at cell ", cell_id)
      ),
      edit_mode !== "delete" && PD.createElement(v, { marginTop: 1, flexDirection: "column" },
        PD.createElement(P, { dimColor: true },
          PD.createElement(pY, { 
            code: new_source, 
            language: cell_type === "markdown" ? "markdown" : "python" 
          })
        )
      )
    )
  );
}

// Tool descriptions
const zO2 = "Replace the contents of a specific cell in a Jupyter notebook.";
const UO2 = `Completely replaces the contents of a specific cell in a Jupyter notebook (.ipynb file) with new source. Jupyter notebooks are interactive documents that combine code, text, and visualizations, commonly used for data analysis and scientific computing. The notebook_path parameter must be an absolute path, not a relative path. The cell_number is 0-indexed. Use edit_mode=insert to add a new cell at the index specified by cell_number. Use edit_mode=delete to delete the cell at the index specified by cell_number.`;

// Input schema
const Mq6 = m.strictObject({
  notebook_path: m.string().describe("The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)"),
  cell_id: m.string().optional().describe("The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified."),
  new_source: m.string().describe("The new source for the cell"),
  cell_type: m.enum(["code", "markdown"]).optional().describe("The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required."),
  edit_mode: m.enum(["replace", "insert", "delete"]).optional().describe("The type of edit to make (replace, insert, delete). Defaults to replace.")
});

// xT - Notebook Editor Tool
export const notebookEditorTool = {
  name: Wc,
  
  async description() {
    return zO2;
  },
  
  async prompt() {
    return UO2;
  },
  
  userFacingName() {
    return "Edit Notebook";
  },
  
  isEnabled() {
    return true;
  },
  
  inputSchema: Mq6,
  
  isConcurrencySafe() {
    return false;
  },
  
  isReadOnly() {
    return false;
  },
  
  getPath(input) {
    return input.notebook_path;
  },
  
  async checkPermissions(input, context) {
    return $_(notebookEditorTool, input, context.getToolPermissionContext());
  },
  
  mapToolResultToToolResultBlockParam({ cell_id, edit_mode, new_source, error }, toolUseId) {
    if (error) {
      return {
        tool_use_id: toolUseId,
        type: "tool_result",
        content: error,
        is_error: true
      };
    }
    
    switch (edit_mode) {
      case "replace":
        return {
          tool_use_id: toolUseId,
          type: "tool_result",
          content: `Updated cell ${cell_id} with ${new_source}`
        };
      case "insert":
        return {
          tool_use_id: toolUseId,
          type: "tool_result",
          content: `Inserted cell ${cell_id} with ${new_source}`
        };
      case "delete":
        return {
          tool_use_id: toolUseId,
          type: "tool_result",
          content: `Deleted cell ${cell_id}`
        };
      default:
        return {
          tool_use_id: toolUseId,
          type: "tool_result",
          content: "Unknown edit mode"
        };
    }
  },
  
  renderToolUseMessage({ notebook_path, cell_id, new_source, cell_type, edit_mode }, { verbose }) {
    if (!notebook_path || !new_source || !cell_type) return null;
    
    if (verbose) {
      return `${notebook_path}@${cell_id}, content: ${new_source.slice(0, 30)}…, cell_type: ${cell_type}, edit_mode: ${edit_mode ?? "replace"}`;
    }
    
    return `${relative(dA(), notebook_path)}@${cell_id}`;
  },
  
  renderToolUseRejectedMessage(input, { verbose }) {
    return K7.createElement(HO2, {
      notebook_path: input.notebook_path,
      cell_id: input.cell_id,
      new_source: input.new_source,
      cell_type: input.cell_type,
      edit_mode: input.edit_mode,
      verbose: verbose
    });
  },
  
  renderToolUseErrorMessage(result, { verbose }) {
    return K7.createElement(HQ, { result, verbose });
  },
  
  renderToolUseProgressMessage() {
    return null;
  },
  
  renderToolResultMessage({ cell_id, new_source, language, error }) {
    if (error) {
      return K7.createElement($0, null,
        K7.createElement(P, { color: "error" }, error)
      );
    }
    
    return K7.createElement($0, null,
      K7.createElement(v, { flexDirection: "column" },
        K7.createElement(P, null, 
          "Updated cell ",
          K7.createElement(P, { bold: true }, cell_id),
          ":"
        ),
        K7.createElement(v, { marginLeft: 2 },
          K7.createElement(pY, { code: new_source, language: language })
        )
      )
    );
  },
  
  async validateInput({ notebook_path, cell_type, cell_id, edit_mode = "replace" }) {
    const absolutePath = isAbsolute(notebook_path) ? notebook_path : resolve(dA(), notebook_path);
    const fs = v1();
    
    if (!fs.existsSync(absolutePath)) {
      return {
        result: false,
        message: "Notebook file does not exist.",
        errorCode: 1
      };
    }
    
    if (extname(absolutePath) !== ".ipynb") {
      return {
        result: false,
        message: "File must be a Jupyter notebook (.ipynb file). For editing other file types, use the FileEdit tool.",
        errorCode: 2
      };
    }
    
    if (edit_mode !== "replace" && edit_mode !== "insert" && edit_mode !== "delete") {
      return {
        result: false,
        message: "Edit mode must be replace, insert, or delete.",
        errorCode: 4
      };
    }
    
    if (edit_mode === "insert" && !cell_type) {
      return {
        result: false,
        message: "Cell type is required when using edit_mode=insert.",
        errorCode: 5
      };
    }
    
    const encoding = aI(absolutePath);
    const content = fs.readFileSync(absolutePath, { encoding });
    const notebook = S4(content);
    
    if (!notebook) {
      return {
        result: false,
        message: "Notebook is not valid JSON.",
        errorCode: 6
      };
    }
    
    if (!cell_id) {
      if (edit_mode !== "insert") {
        return {
          result: false,
          message: "Cell ID must be specified when not inserting a new cell.",
          errorCode: 7
        };
      }
    } else {
      const cellIndex = Qc(cell_id);
      if (cellIndex !== undefined) {
        if (!notebook.cells[cellIndex]) {
          return {
            result: false,
            message: `Cell with index ${cellIndex} does not exist in notebook.`,
            errorCode: 7
          };
        }
      } else if (!notebook.cells.find(cell => cell.id === cell_id)) {
        return {
          result: false,
          message: `Cell with ID "${cell_id}" not found in notebook.`,
          errorCode: 8
        };
      }
    }
    
    return { result: true };
  },
  
  async *call({ notebook_path, new_source, cell_id, cell_type, edit_mode }) {
    const absolutePath = isAbsolute(notebook_path) ? notebook_path : resolve(dA(), notebook_path);
    
    try {
      const encoding = aI(absolutePath);
      const content = v1().readFileSync(absolutePath, { encoding });
      const notebook = JSON.parse(content);
      
      let cellIndex;
      
      if (!cell_id) {
        cellIndex = 0;
      } else {
        const numericIndex = Qc(cell_id);
        if (numericIndex !== undefined) {
          cellIndex = numericIndex;
          if (edit_mode === "insert") cellIndex += 1;
        } else {
          cellIndex = notebook.cells.findIndex(cell => cell.id === cell_id);
          if (edit_mode === "insert") cellIndex += 1;
        }
      }
      
      let actualEditMode = edit_mode;
      
      // Convert replace to insert if cell doesn't exist
      if (actualEditMode === "replace" && cellIndex === notebook.cells.length) {
        actualEditMode = "insert";
        if (!cell_type) cell_type = "code";
      }
      
      const language = notebook.metadata.language_info?.name ?? "python";
      let newCellId = undefined;
      
      // Generate cell ID for nbformat 4.5+
      if (notebook.nbformat > 4 || (notebook.nbformat === 4 && notebook.nbformat_minor >= 5)) {
        if (actualEditMode === "insert") {
          newCellId = Math.random().toString(36).substring(2, 15);
        } else if (cell_id !== null) {
          newCellId = cell_id;
        }
      }
      
      // Apply the edit
      if (actualEditMode === "delete") {
        notebook.cells.splice(cellIndex, 1);
      } else if (actualEditMode === "insert") {
        const newCell = {
          cell_type: cell_type,
          id: newCellId,
          source: new_source,
          metadata: {}
        };
        
        notebook.cells.splice(cellIndex, 0, 
          cell_type === "markdown" ? newCell : { ...newCell, outputs: [] }
        );
      } else {
        const existingCell = notebook.cells[cellIndex];
        existingCell.source = new_source;
        existingCell.execution_count = undefined;
        existingCell.outputs = [];
        
        if (cell_type && cell_type !== existingCell.cell_type) {
          existingCell.cell_type = cell_type;
        }
      }
      
      // Write back to file
      const backupPath = xN(absolutePath);
      lM(absolutePath, JSON.stringify(notebook, null, 1), encoding, backupPath);
      
      yield {
        type: "result",
        data: {
          new_source,
          cell_type: cell_type ?? "code",
          language,
          edit_mode: actualEditMode ?? "replace",
          cell_id: newCellId || undefined,
          error: ""
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        yield {
          type: "result",
          data: {
            new_source,
            cell_type: cell_type ?? "code",
            language: "python",
            edit_mode: "replace",
            error: error.message,
            cell_id
          }
        };
        return;
      }
      
      yield {
        type: "result",
        data: {
          new_source,
          cell_type: cell_type ?? "code",
          language: "python",
          edit_mode: "replace",
          error: "Unknown error occurred while editing notebook",
          cell_id
        }
      };
    }
  }
};