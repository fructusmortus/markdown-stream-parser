import fs from 'fs'
import Parser from 'tree-sitter'
import Markdown from '@tree-sitter-grammars/tree-sitter-markdown';
import { MarkdownStreamParser } from '../../src/tree-sitter-markdown-stream-parser.ts'

import { log, info, infoStr, warn, err } from './debug-tools.ts'

// Parse CLI arguments
const args = process.argv.slice(2);
let DELAY = 0;
let fileName = '';

for (const arg of args) {
    if (arg.startsWith('--interval=')) {
        const val = parseInt(arg.split('=')[1], 10);
        if (!isNaN(val)) DELAY = val;
    }
    if (arg.startsWith('--file=')) {
        fileName = arg.split('=')[1];
    }
}

if (!fileName) {
    throw new Error('Missing required argument: --file=<path-to-file>');
}

// const sourceFile = `/usr/src/service/demo/llm-streams-examples/${fileName}`;
const markdownLines = [
    "####",
    " 🐾",
    " **",
    "Regex",
    " Lesson",
    ":",
    " Evalu",
    "ating",
    " Cat",
    " Bre",
    "eds",
    "**\n\n",
    "Regex",
    ",",
    " or",
    " **",
    "regular",
    " expressions",
    "**,",
    " are",
    " a",
    " powerful",
    " textual",
    " tool",
    " often",
    " used",
    " in",
    " programming",
    " for",
    " finding",
    "```",
    "python",
    "\n",
    "import",
    " re",
    "\n\n",
    "#",
    " List",
    " of",
    " cat",
    " breeds",
    "\n",
    "cat",
    "_b",
    "re",
    "eds",
    " =",
    " ['",
    "S",
    "iam",
    "ese",
    "',",
    " '",
    "Pers",
    "ian",
    "',",
    " '",
    "M",
    "aine",
    " C",
    "oon",
    "',",
    " '",
    "B",
    "eng",
    "al",
    "',",
    " '",
    "S",
    "ph",
    "yn",
    "x",
    "']\n\n",
    "#",
    " Join",
    " breeds",
    " into",
    " a",
    " regex",
    " pattern",
    "\n",
    "pattern",
    " =",
    " r",
    "'\\",
    "b",
    "(?:",
    "'",
    " +",
    " '|",
    "'.",
    "join",
    "(map",
    "(re",
    ".escape",
    ",",
    " cat",
    "_b",
    "re",
    "eds",
    "))",
    " +",
    " r",
    "')",
    "\\",
    "b",
    "'\n\n",
    "#",
    " Sample",
    " sentences",
    "\n",
    "text",
    " =",
    " \"",
    "I",
    " have",
    " a",
    " Bengal",
    " and",
    " a",
    " Maine",
    " C",
    "oon",
    ",",
    " but",
    " my",
    " friend",
    " prefers",
    " S",
    "ph",
    "yn",
    "x",
    " cats",
    ".\"\n\n",
    "#",
    " Search",
    " for",
    " matches",
    "\n",
    "matches",
    " =",
    " re",
    ".findall",
    "(pattern",
    ",",
    " text",
    ",",
    " flags",
    "=re",
    ".",
    "IGNORE",
    "CASE",
    ")\n\n",
    "print",
    "(\"",
    "Cat",
    " breeds",
    " found",
    ":\",",
    " matches",
    ")\n",
    "``",
    "`\n\n",
    "---\n\n",
]

// Initialize tree-sitter parser
// const parser = new Parser();
// parser.setLanguage(Markdown);

// const treeSitter = parser.parse(sourceFile);

const streamParser = new MarkdownStreamParser();

let accumulatedElements = [];

markdownLines.forEach((chunk, index) => {
    console.log(`\n=== Processing chunk ${index}: "${chunk.replace(/\n/g, '\\n')}" ===`);
    
    streamParser.processLine(chunk);
    
    const currentElements = streamParser.getCompletedElements();
    
    // Show only newly completed elements
    const newElements = currentElements.filter(elem => 
        !accumulatedElements.some(acc => 
            acc.type === elem.type && acc.text === elem.text
        )
    );
    
    if (newElements.length > 0) {
        console.log('Newly completed elements:');
        newElements.forEach(elem => {
            const preview = elem.text.replace(/\n/g, '\\n').substring(0, 60);
            console.log(`  - ${elem.type}${elem.level ? ` (h${elem.level})` : ''}: "${preview}${elem.text.length > 60 ? '...' : ''}"`);
        });
        accumulatedElements = currentElements;
    } else {
        console.log('No newly completed elements yet');
    }
    
    // Debug tree for specific chunks
    if (chunk.includes('\n\n')) {
        streamParser.debugTree();
    }
});

console.log('\n=== Final completed elements ===');
accumulatedElements.forEach(elem => {
    console.log(`- ${elem.type}${elem.level ? ` (h${elem.level})` : ''}: "${elem.text.substring(0, 50)}${elem.text.length > 50 ? '...' : ''}"`);
});


// console.log("\n\n\n TREE", treeSitter);
// const callExpression = treeSitter.rootNode.child(1).firstChild;
// console.log(callExpression);

// Variables to maintain state
let content = '';
// let tree = null;
let subscribers = [];
let isParsingActive = false;

// Functions to mimic the original API
// const startParsing = () => {
//     isParsingActive = true;
//     content = '';
//     tree = null;
// };

// const parseToken = (chunk) => {
//     if (!isParsingActive) return;

//     const textChunk = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
//     content += textChunk;
    
//     // Parse the current content
//     tree = parser.parse(content, tree);
    
//     // Create a simplified representation of the parse tree
//     const parsedSegment = {
//         ast: simplifyNode(tree.rootNode),
//         content: content,
//         status: 'PARSING'
//     };
    
//     // Notify subscribers
//     notifySubscribers(parsedSegment);
// };

// const stopParsing = () => {
//     isParsingActive = false;
    
//     if (content && tree) {
//         // Final parse
//         tree = parser.parse(content, tree);
        
//         const finalSegment = {
//             ast: simplifyNode(tree.rootNode),
//             content: content,
//             status: 'END_STREAM'
//         };
        
//         notifySubscribers(finalSegment);
//     }
// };

// // Helper to simplify the tree-sitter node structure
// const simplifyNode = (node) => {
//     if (!node) return null;
    
//     const result = {
//         type: node.type,
//         text: node.text,
//         startPosition: node.startPosition,
//         endPosition: node.endPosition
//     };
    
//     if (node.childCount > 0) {
//         result.children = [];
//         for (let i = 0; i < node.childCount; i++) {
//             const child = node.child(i);
//             if (child) {
//                 result.children.push(simplifyNode(child));
//             }
//         }
//     }
    
//     return result;
// };

// // Subscription management
// const subscribeToTokenParse = (callback) => {
//     const subscriber = { callback };
//     subscribers.push(subscriber);
    
//     const unsubscribe = () => {
//         const index = subscribers.indexOf(subscriber);
//         if (index !== -1) {
//             subscribers.splice(index, 1);
//         }
//     };
    
//     return unsubscribe;
// };

// const notifySubscribers = (parsedSegment) => {
//     for (const subscriber of subscribers) {
//         const unsubscribe = () => {
//             const index = subscribers.indexOf(subscriber);
//             if (index !== -1) {
//                 subscribers.splice(index, 1);
//             }
//         };
        
//         subscriber.callback(parsedSegment, unsubscribe);
//     }
// };

// // Stream JSON chunks (unchanged from your original code)
// type JSONChunk = string | object;

// async function* streamJSONinChunks(jsonArray: JSONChunk[]): AsyncGenerator<JSONChunk, void, unknown> {
//     const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

//     for (const item of jsonArray) {
//         if (item !== '') {
//             yield item;
//             await delay(DELAY);
//         }
//     }
// }

// // Main execution
// (async () => {
//     console.log('\n');

//     const jsonContent: string = fs.readFileSync(sourceFile, { encoding: 'utf-8' });
//     const parsedJson: JSONChunk[] = JSON.parse(jsonContent);
//     const textStream = streamJSONinChunks(parsedJson);

//     startParsing();  // Start parsing before creating the stream

//     for await (const chunk of textStream) {
//         parseToken(chunk);
//     }

//     stopParsing();  // Flush any remaining content at the end
// })();

// // Subscribe to parse events
// const unsubscribe = subscribeToTokenParse(
//     (parsedSegment, unsubscribe) => {
//         console.log('parsedSegment', parsedSegment);

//         // Unsubscribe at the end of the stream
//         if (parsedSegment.status === 'END_STREAM') {
//             unsubscribe();
//             // No need to remove instance as we're not using the class approach
//         }
//     }
// );
