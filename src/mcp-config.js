/**
 * MCP Configuration Management
 */

const { O0 } = require('./utils'); // Assuming O0 is a memoization utility
const { wu1 } = require('./path-utils'); // Assuming wu1 is a path utility
const fs = require('fs');
const { J9 } = require('./logger'); // Assuming J9 is a logging function
const { E1 } = require('./telemetry'); // Assuming E1 is a telemetry function

// Function to parse .mcp.json content
function parseMcpJson(content) {
    let parsed = {};
    try {
        let json = JSON.parse(content);
        // Assuming Fu.safeParse is a Zod schema for MCP config
        // let result = Fu.safeParse(json);
        // if (result.success) {
        //     for (let [key, value] of Object.entries(result.data.mcpServers)) {
        //         parsed[key] = value;
        //     }
        // } else {
        //     J9(`Error parsing .mcp.json: ${result.error.message}`);
        // }
    } catch (error) {
        J9(`Error parsing .mcp.json: ${error.message}`);
    }
    return parsed;
}

// Function to write .mcp.json content
function writeMcpJson(config) {
    let filePath = wu1(require('./system-core').dA(), ".mcp.json"); // Assuming dA gets base directory
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), {encoding: "utf8"});
}

// Function to get MCP servers (memoized)
const getMcpServers = O0(() => {
    let filePath = wu1(require('./system-core').dA(), ".mcp.json");
    if (!fs.existsSync(filePath)) return {};
    try {
        let content = fs.readFileSync(filePath, {encoding: "utf-8"});
        let servers = parseMcpJson(content);
        E1("tengu_mcpjson_found", {numServers: Object.keys(servers).length});
        return servers;
    } catch {
        return {};
    }
}, () => {
    let filePath = wu1(require('./system-core').dA(), ".mcp.json");
    if (fs.existsSync(filePath)) {
        try {
            let content = fs.readFileSync(filePath, {encoding: "utf-8"});
            return `${require('./system-core').dA()}:${content}`;
        } catch {
            return require('./system-core').dA();
        }
    }
    return require('./system-core').dA();
});

module.exports = {
    parseMcpJson,
    writeMcpJson,
    getMcpServers
};
