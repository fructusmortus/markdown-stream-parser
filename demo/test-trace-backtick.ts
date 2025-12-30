import { MarkdownStreamParser } from '../src/tree-sitter-markdown-stream-parser.ts';
import { Parser, Language } from 'web-tree-sitter';

async function test() {
    // First test what tree-sitter sees
    await Parser.init();
    const inlineLang = await Language.load('./demo/svelte-demo/static/tree-sitter-markdown-inline.wasm');
    const inlineParser = new Parser();
    inlineParser.setLanguage(inlineLang);
    
    // Test what the inline parser sees for "- `\b`: A"
    const testContent = "- `\\b`: A";
    console.log('=== Testing inline parser directly ===');
    console.log(`Content: "${testContent}"`);
    const inlineTree = inlineParser.parse(testContent);
    console.log('Inline tree:', inlineTree.rootNode.toString());
    const codeSpans = inlineTree.rootNode.descendantsOfType('code_span');
    console.log('Code spans found:', codeSpans.length);
    codeSpans.forEach(span => {
        console.log(`  code_span: "${span.text}" (${span.startIndex}-${span.endIndex})`);
    });
    
    // Now test with the parser
    console.log('\n=== Testing with MarkdownStreamParser ===\n');
    
    // Configure WASM
    MarkdownStreamParser.configureWasmPath('./demo/svelte-demo/static/tree-sitter-markdown.wasm');
    
    const parser = await MarkdownStreamParser.getInstance('trace-test');
    const segments: any[] = [];
    
    parser.subscribeToTokenParse((chunk) => {
        if (chunk.status === 'STREAMING' && chunk.segment) {
            segments.push(chunk.segment);
            console.log(`EMIT: [${chunk.segment.type}]${chunk.segment.styles?.length ? ' styles: ' + chunk.segment.styles.join(',') : ''}: "${chunk.segment.segment}"`);
        }
    });
    
    parser.startParsing();
    
    // Simulate the exact stream
    const chunks = ["- ", "`", "\\", "b", "`:", " A", " word"];
    for (const chunk of chunks) {
        console.log(`PARSE: "${chunk}"`);
        parser.parseToken(chunk);
    }
    
    parser.stopParsing();
    
    console.log('\n=== Final segments ===');
    segments.forEach((seg, i) => {
        console.log(`${i + 1}. [${seg.type}]${seg.styles?.length ? ' styles: ' + seg.styles.join(',') : ''}: "${seg.segment}"`);
    });
    
    const withBackticks = segments.filter(s => s.segment.includes('`'));
    console.log(`\n${withBackticks.length === 0 ? '✅' : '❌'} Segments with backticks: ${withBackticks.length}`);
}

test().catch(console.error);
