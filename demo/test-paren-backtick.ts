import { MarkdownStreamParser } from '../src/tree-sitter-markdown-stream-parser.ts';

async function test() {
    // Configure WASM
    MarkdownStreamParser.configureWasmPath('./demo/svelte-demo/static/tree-sitter-markdown.wasm');
    
    const parser = await MarkdownStreamParser.getInstance('trace-paren-test');
    const segments: any[] = [];
    
    parser.subscribeToTokenParse((chunk) => {
        if (chunk.status === 'STREAMING' && chunk.segment) {
            segments.push(chunk.segment);
            if (chunk.segment.segment.includes('`')) {
                console.log(`EMIT with backtick: [${chunk.segment.type}]${chunk.segment.styles?.length ? ' styles: ' + chunk.segment.styles.join(',') : ''}: "${chunk.segment.segment}"`);
            }
        }
    });
    
    parser.startParsing();
    
    // Simulate the EXACT stream from gpt-4.5-cat-coding.json
    // Tokens 99-105: "(`", "re", "`", " module", ")"
    console.log('\n=== Testing: (`re` module) - exact stream tokens ===\n');
    
    const chunks = ["(`", "re", "`", " module", ")"];
    for (const chunk of chunks) {
        console.log(`PARSE: "${chunk}"`);
        parser.parseToken(chunk);
    }
    
    parser.stopParsing();
    
    console.log('\n=== Final segments ===');
    segments.forEach((seg, i) => {
        console.log(`${i + 1}. [${seg.type}]${seg.styles?.length ? ' styles: ' + seg.styles.join(',') : ''}: "${seg.segment}"`);
    });
}

test().catch(console.error);
