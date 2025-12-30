import { Parser, Language } from 'web-tree-sitter';

async function test() {
    await Parser.init();
    const parser = new Parser();
    
    // Use Language.load 
    const lang = await Language.load('./demo/svelte-demo/static/tree-sitter-markdown.wasm');
    const inlineLang = await Language.load('./demo/svelte-demo/static/tree-sitter-markdown-inline.wasm');
    parser.setLanguage(lang);
    
    const inlineParser = new Parser();
    inlineParser.setLanguage(inlineLang);
    
    // Simulate incremental parsing - INCOMPLETE code span
    let content = 'Here is `inline ';
    let tree = parser.parse(content);
    console.log('=== After "Here is `inline " (incomplete) ===');
    console.log('Block tree:', tree.rootNode.toString());
    console.log('Full content length:', content.length);
    
    // Find inline node and parse it
    const inline1 = tree.rootNode.descendantsOfType('inline')[0];
    if (inline1) {
        console.log('inline range:', inline1.startIndex, '-', inline1.endIndex);
        console.log('inline text:', JSON.stringify(inline1.text));
        const inlineTree = inlineParser.parse(inline1.text);
        console.log('inline parsed:', inlineTree.rootNode.toString());
    }
    
    // Add closing backtick - COMPLETE code span
    const oldContent = content;
    content += 'code` test';
    console.log('\n=== After "Here is `inline code` test" (complete) ===');
    console.log('Full content:', JSON.stringify(content));
    console.log('Content length:', content.length);
    
    // Tell tree-sitter what changed BEFORE re-parsing
    tree.edit({
        startIndex: oldContent.length,
        oldEndIndex: oldContent.length,
        newEndIndex: content.length,
        startPosition: { row: 0, column: oldContent.length },
        oldEndPosition: { row: 0, column: oldContent.length },
        newEndPosition: { row: 0, column: content.length }
    });
    
    tree = parser.parse(content, tree);
    console.log('Block tree:', tree.rootNode.toString());
    
    const inline2 = tree.rootNode.descendantsOfType('inline')[0];
    if (inline2) {
        console.log('inline range:', inline2.startIndex, '-', inline2.endIndex);
        console.log('inline text:', JSON.stringify(inline2.text));
        const inlineTree = inlineParser.parse(inline2.text);
        console.log('inline parsed:', inlineTree.rootNode.toString());
    }
}
test();
