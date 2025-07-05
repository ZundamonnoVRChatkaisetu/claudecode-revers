// Bash Tool Result Renderer
// Reconstructed from cli.js lines 1577-1586

const ST = require('react');

// Content renderer component for tool results
function Fc({ content: A, verbose: B }) {
    let { stdout: Q, stderr: D, isImage: I, returnCodeInterpretation: G } = A;
    
    // Handle image data
    if (I) {
        return ST.default.createElement($0, { height: 1 }, 
            ST.default.createElement(P, { color: "secondaryText" }, 
                "[Image data detected and sent to Claude]"
            )
        );
    }
    
    // Render stdout and stderr
    return ST.default.createElement(v, { flexDirection: "column" },
        // Stdout content
        Q !== "" ? ST.default.createElement(yU, { 
            content: Q, 
            verbose: B 
        }) : null,
        
        // Stderr content (as error)
        D !== "" ? ST.default.createElement(yU, { 
            content: D, 
            verbose: B, 
            isError: true 
        }) : null,
        
        // Empty content fallback
        Q === "" && D === "" ? ST.default.createElement($0, { height: 1 },
            ST.default.createElement(P, { color: "secondaryText" }, 
                G || "(No content)"
            )
        ) : null
    );
}

module.exports = {
    Fc
};