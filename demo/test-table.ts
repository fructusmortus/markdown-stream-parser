import { Parser, Language } from 'web-tree-sitter';

async function test() {
    await Parser.init();
    const lang = await Language.load('./demo/svelte-demo/static/tree-sitter-markdown.wasm');
    const parser = new Parser();
    parser.setLanguage(lang);
    
    const tableContent = `| Pattern  | Description             |
|----------|-------------------------|
| \`\\bword\\b\` | Matches whole words only              |
`;
    
    console.log('=== Table content ===');
    console.log(tableContent);
    
    const tree = parser.parse(tableContent);
    console.log('\n=== Tree ===');
    console.log(tree.rootNode.toString());
    
    // Find all node types recursively
    const printNodes = (node: Parser.SyntaxNode, indent = 0) => {
        console.log(' '.repeat(indent) + `${node.type}(${node.startIndex}-${node.endIndex}): "${node.text.substring(0, 30).replace(/\n/g, '\\n')}..."`);
        for (let i = 0; i < node.childCount; i++) {
            printNodes(node.child(i)!, indent + 2);
        }
    };
    
    console.log('\n=== Node details ===');
    printNodes(tree.rootNode);
}

test().catch(console.error);
