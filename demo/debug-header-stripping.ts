import { MarkdownStreamParser } from '../src/tree-sitter-markdown-stream-parser.ts';
import fs from 'fs';

async function test() {
    // Configure WASM
    MarkdownStreamParser.configureWasmPath('./demo/svelte-demo/static/tree-sitter-markdown.wasm');
    
    const parser = await MarkdownStreamParser.getInstance('debug-test');
    const segments: any[] = [];
    
    parser.subscribeToTokenParse((chunk) => {
        if (chunk.status === 'STREAMING' && chunk.segment) {
            segments.push(chunk.segment);
        }
    });
    
    parser.startParsing();
    
    // Test code blocks and inline code
    console.log('\n=== Testing Code Blocks and Inline Code ===\n');
    
    // Test 1: Word-by-word like TokensStreamBuffer does
    console.log('Test 1: Word-by-word inline code (simulating TokensStreamBuffer)');
    parser.parseToken('Here ');
    parser.parseToken('is ');
    parser.parseToken('`inline ');  // Opening backtick + partial content
    parser.parseToken('code` ');    // Closing - NOW tree-sitter should detect code_span
    parser.parseToken('test\n\n');
    
    // Test 2: Inline code where each word is already separate (works correctly)
    console.log('\nTest 2: Single-word inline code (works correctly)');
    parser.parseToken('This ');
    parser.parseToken('is ');
    parser.parseToken('`another` ');  // Single word between backticks - arrives complete
    parser.parseToken('test\n\n');
    
    // Test fenced code block
    parser.parseToken('```');
    parser.parseToken('python\n');
    parser.parseToken('def hello():\n');
    parser.parseToken('    print("world")\n');
    parser.parseToken('```');
    parser.parseToken('\n');
    
    parser.stopParsing();
    
    console.log('\n=== All Segments ===');
    segments.forEach((seg, i) => {
        console.log(`${i + 1}. [${seg.type}]${seg.styles?.length ? ' styles: ' + seg.styles.join(',') : ''}: "${seg.segment}"`);
    });
    
    const codeBlocks = segments.filter(s => s.type === 'codeBlock');
    const inlineCode = segments.filter(s => s.styles?.includes('code'));
    
    console.log(`\n✓ Code blocks found: ${codeBlocks.length}`);
    console.log(`✓ Inline code segments found: ${inlineCode.length}`);
    
    // Check for backticks in content
    // NOTE: Some backticks may remain due to TokensStreamBuffer splitting words mid-code-span
    const segmentsWithBackticks = segments.filter(s => s.segment.includes('`'));
    console.log(`\n${segmentsWithBackticks.length > 0 ? '⚠️ ' : '✅'} Segments with backticks: ${segmentsWithBackticks.length}`);
    if (segmentsWithBackticks.length > 0) {
        console.log('   (Note: Due to word-boundary splitting by TokensStreamBuffer)');
        segmentsWithBackticks.forEach(s => console.log(`  - [${s.type}]: "${s.segment}"`));
    }
}

test().catch(console.error);
