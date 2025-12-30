import { MarkdownStreamParser } from '../src/tree-sitter-markdown-stream-parser.ts';

async function test() {
    MarkdownStreamParser.configureWasmPath('./demo/svelte-demo/static/tree-sitter-markdown.wasm');
    
    const parser = await MarkdownStreamParser.getInstance('list-test');
    const segments: any[] = [];
    
    parser.subscribeToTokenParse((chunk) => {
        if (chunk.status === 'STREAMING' && chunk.segment) {
            segments.push(chunk.segment);
            console.log(`EMIT: [${chunk.segment.type}] isBlockDefining=${chunk.segment.isBlockDefining} "${chunk.segment.segment.replace(/\n/g, '\\n')}"`);
        }
    });
    
    parser.startParsing();
    
    console.log('\n=== Testing list items ===\n');
    
    // Simulating list items
    parser.parseToken("- First item\n- Second item\n");
    
    parser.stopParsing();
    
    console.log('\n=== Final segments ===');
    segments.forEach((seg, i) => {
        console.log(`${i + 1}. [${seg.type}] isBlockDefining=${seg.isBlockDefining} "${seg.segment.replace(/\n/g, '\\n')}"`);
    });
}

test().catch(console.error);
