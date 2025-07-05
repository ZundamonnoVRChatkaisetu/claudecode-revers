import fs from 'fs';
import path from 'path';

export const NOTEBOOK_READER_TOOL_NAME = 'notebookRead';

export const notebookReaderSchema = {
  name: 'notebook_path',
  description: 'The absolute path to the Jupyter notebook file to read (must be absolute, not relative)',
  type: 'string'
};

export function validateNotebookContent(content) {
  if (!content) return '';
  const contentStr = Array.isArray(content) ? content.join('') : content;
  const { truncatedContent } = truncateContent(contentStr);
  return truncatedContent;
}

export function extractImageFromOutput(data) {
  if (typeof data['image/png'] === 'string') {
    return {
      image_data: data['image/png'].replace(/\s/g, ''),
      media_type: 'image/png'
    };
  }
  if (typeof data['image/jpeg'] === 'string') {
    return {
      image_data: data['image/jpeg'].replace(/\s/g, ''),
      media_type: 'image/jpeg'
    };
  }
  return undefined;
}

export function processNotebookOutput(output) {
  switch (output.output_type) {
    case 'stream':
      return {
        output_type: output.output_type,
        text: validateNotebookContent(output.text)
      };
    case 'execute_result':
    case 'display_data':
      return {
        output_type: output.output_type,
        text: validateNotebookContent(output.data?.['text/plain']),
        image: output.data && extractImageFromOutput(output.data)
      };
    case 'error':
      return {
        output_type: output.output_type,
        text: validateNotebookContent(`${output.ename}: ${output.evalue}\n${output.traceback.join('\n')}`)
      };
    default:
      return output;
  }
}

export function processNotebookCell(cell, index, language, includeOutputs = false) {
  const cellId = cell.id ?? `cell-${index}`;
  const processedCell = {
    cellType: cell.cell_type,
    source: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
    execution_count: cell.execution_count,
    cell_id: cellId
  };

  if (cell.cell_type === 'code') {
    processedCell.language = language;
  }

  if (cell.outputs?.length) {
    const processedOutputs = cell.outputs.map(processNotebookOutput);
    
    if (!includeOutputs && JSON.stringify(processedOutputs).length > 10000) {
      processedCell.outputs = [{
        output_type: 'stream',
        text: `Outputs are too large to include. Use ${NOTEBOOK_READER_TOOL_NAME} with parameter cell_id=${cellId} to read cell outputs`
      }];
    } else {
      processedCell.outputs = processedOutputs;
    }
  }

  return processedCell;
}

export function formatCellToText(cell) {
  const metadata = [];
  
  if (cell.cellType !== 'code') {
    metadata.push(`<cell_type>${cell.cellType}</cell_type>`);
  }
  
  if (cell.language !== 'python' && cell.cellType === 'code') {
    metadata.push(`<language>${cell.language}</language>`);
  }

  return {
    text: `<cell id="${cell.cell_id}">${metadata.join('')}${cell.source}</cell id="${cell.cell_id}">`,
    type: 'text'
  };
}

export function formatOutputToContent(output) {
  const content = [];
  
  if (output.text) {
    content.push({
      text: `\n${output.text}`,
      type: 'text'
    });
  }
  
  if (output.image) {
    content.push({
      type: 'image',
      source: {
        data: output.image.image_data,
        media_type: output.image.media_type,
        type: 'base64'
      }
    });
  }
  
  return content;
}

export function formatCellWithOutputs(cell) {
  const cellContent = formatCellToText(cell);
  const outputContents = cell.outputs?.flatMap(formatOutputToContent) || [];
  return [cellContent, ...outputContents];
}

export function readNotebookFile(notebookPath, cellId = null) {
  const resolvedPath = path.resolve(notebookPath);
  
  if (!resolvedPath) {
    throw new Error('Invalid notebook path');
  }

  const notebookContent = fs.readFileSync(resolvedPath, { encoding: 'utf-8' });
  const notebook = JSON.parse(notebookContent);
  const language = notebook.metadata.language_info?.name ?? 'python';

  if (cellId) {
    const targetCell = notebook.cells.find(cell => cell.id === cellId);
    if (!targetCell) {
      throw new Error(`Cell with ID "${cellId}" not found in notebook`);
    }
    return [processNotebookCell(targetCell, notebook.cells.indexOf(targetCell), language, true)];
  }

  return notebook.cells.map((cell, index) => 
    processNotebookCell(cell, index, language, false)
  );
}

export function convertNotebookToToolResult(cells, toolUseId) {
  const contents = cells.flatMap(formatCellWithOutputs);
  
  return {
    tool_use_id: toolUseId,
    type: 'tool_result',
    content: contents.reduce((acc, item) => {
      if (acc.length === 0) return [item];
      
      const lastItem = acc[acc.length - 1];
      if (lastItem && lastItem.type === 'text' && item.type === 'text') {
        lastItem.text += '\n' + item.text;
        return acc;
      }
      
      return [...acc, item];
    }, [])
  };
}

export function parseCellIndex(cellId) {
  const match = cellId.match(/^cell-(\d+)$/);
  if (match && match[1]) {
    const index = parseInt(match[1], 10);
    return isNaN(index) ? undefined : index;
  }
  return undefined;
}

function truncateContent(content, maxLength = 10000) {
  if (content.length <= maxLength) {
    return { truncatedContent: content };
  }
  return { 
    truncatedContent: content.substring(0, maxLength) + '\n... [content truncated]'
  };
}