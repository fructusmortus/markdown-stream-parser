import { MarkdownStreamParser } from '../src/tree-sitter-markdown-stream-parser.ts';
import fs from 'fs';

async function test() {
    // Configure WASM
    MarkdownStreamParser.configureWasmPath('./demo/svelte-demo/static/tree-sitter-markdown.wasm');
    
    const parser = await MarkdownStreamParser.getInstance('real-stream-test');
    const segments: any[] = [];
    
    parser.subscribeToTokenParse((chunk) => {
        if (chunk.status === 'STREAMING' && chunk.segment) {
            segments.push(chunk.segment);
        }
    });
    
    parser.startParsing();
    
    // Load actual stream data
    const streamData = JSON.parse(fs.readFileSync('./demo/llm-streams-examples/gpt-4.5-cat-coding.json', 'utf-8'));
    
    // Feed each chunk
    for (const chunk of streamData) {
        parser.parseToken(chunk);
    }
    
    parser.stopParsing();
    
    // Find segments with backticks
    console.log('\n=== Segments with backticks ===');
    segments.forEach((seg, i) => {
        if (seg.segment.includes('`')) {
            console.log(`${i + 1}. [${seg.type}]${seg.styles?.length ? ' styles: ' + seg.styles.join(',') : ''}: "${seg.segment}"`);
        }
    });
    
    // Check the "Regex Pattern Explained" section
    console.log('\n=== Around "Regex Pattern Explained" ===');
    let foundSection = false;
    segments.forEach((seg, i) => {
        if (seg.segment.includes('Pattern') || seg.segment.includes('Explained') || foundSection) {
            if (seg.segment.includes('Pattern')) foundSection = true;
            if (foundSection) {
                console.log(`${i + 1}. [${seg.type}]${seg.styles?.length ? ' styles: ' + seg.styles.join(',') : ''}: "${seg.segment}"`);
            }
            // Stop after a few more
            if (foundSection && seg.segment.includes('IGNORECASE')) {
                foundSection = false;
            }
        }
    });
    
    const withBackticks = segments.filter(s => s.segment.includes('`'));
    console.log(`\n❌ Total segments with backticks: ${withBackticks.length}`);
}

test().catch(console.error);
