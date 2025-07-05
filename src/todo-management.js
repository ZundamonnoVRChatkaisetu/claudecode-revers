/**
 * Todo Management System
 */

const m = require('zod'); // Assuming 'zod' is imported or defined elsewhere
const { join } = require('path');
const fs = require('fs');
const { v1 } = require('uuid'); // Assuming uuid v1 is used for unique IDs
const { h1 } = require('./error-utils'); // Assuming error-utils is available
const { fN } = require('./file-system'); // Assuming file-system is available
const { PB } = require('./system-core'); // Assuming system-core is available

// Todo item Zod schemas
const TodoStatusSchema = m.enum(["pending", "in_progress", "completed"]);
const TodoPrioritySchema = m.enum(["high", "medium", "low"]);
const TodoItemSchema = m.object({content: m.string().min(1,"Content cannot be empty"), status: TodoStatusSchema, priority: TodoPrioritySchema, id: m.string()});
const TodoListSchema = m.array(TodoItemSchema);

// Todo storage file system functions
function getTodoDirectory() {
    let todoDir = join(PB(), "todos");
    if (!fs.existsSync(todoDir)) fs.mkdirSync(todoDir);
    return todoDir;
}

function getAgentTodoFilePath(agentId) {
    let fileName = `${PB()}-agent-${agentId}.json`;
    return join(getTodoDirectory(), fileName);
}

function readAgentTodos(agentId) {
    return readTodosFromFile(getAgentTodoFilePath(agentId));
}

function writeAgentTodos(todos, agentId) {
    writeTodosToFile(todos, getAgentTodoFilePath(agentId));
}

// Todo sorting logic
const todoStatusOrder = {completed: 0, in_progress: 1, pending: 2};
const todoPriorityOrder = {high: 0, medium: 1, low: 2};

function sortTodos(todoA, todoB) {
    let statusDiff = todoStatusOrder[todoA.status] - todoStatusOrder[todoB.status];
    if (statusDiff !== 0) return statusDiff;
    return todoPriorityOrder[todoA.priority] - todoPriorityOrder[todoB.priority];
}

// Session management functions
function handleSessionContinuation(session) {
    if (session.messages.length > 0) {
        let firstMessage = session.messages[0];
        if (firstMessage && "sessionId" in firstMessage) copyTodosBetweenAgents(firstMessage.sessionId, PB());
    }
}

function copyTodosBetweenAgents(sourceAgentId, targetAgentId) {
    let sourceFilePath = join(getTodoDirectory(), `${sourceAgentId}-agent-${sourceAgentId}.json`);
    let targetFilePath = join(getTodoDirectory(), `${targetAgentId}-agent-${targetAgentId}.json`);
    try {
        let todos = readTodosFromFile(sourceFilePath);
        if (todos.length === 0) return false;
        return writeTodosToFile(todos, targetFilePath), true;
    } catch (error) {
        return h1(error instanceof Error ? error : new Error(String(error))), false;
    }
}

// File read/write utilities
function readTodosFromFile(filePath) {
    if (!fs.existsSync(filePath)) return [];
    try {
        let content = fs.readFileSync(filePath, {encoding: "utf-8"});
        return TodoListSchema.parse(JSON.parse(content));
    } catch (error) {
        return h1(error instanceof Error ? error : new Error(String(error))), [];
    }
}

function writeTodosToFile(todos, filePath) {
    try {
        fN(filePath, JSON.stringify(todos, null, 2));
    } catch (error) {
        h1(error instanceof Error ? error : new Error(String(error)));
    }
}

// TodoWrite tool prompt (co0)
const todoWritePrompt = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.\nIt also helps the user understand the progress of the task and overall progress of their requests.\n\n## When to Use This Tool\nUse this tool proactively in these scenarios:`;

module.exports = {
    TodoStatusSchema, TodoPrioritySchema, TodoItemSchema, TodoListSchema, getTodoDirectory, getAgentTodoFilePath, readAgentTodos, writeAgentTodos, todoStatusOrder, todoPriorityOrder, sortTodos, handleSessionContinuation, copyTodosBetweenAgents, readTodosFromFile, writeTodosToFile, todoWritePrompt
};
