
const mod = require('web-tree-sitter');
// Handle both CommonJS and potentially different export structures
const Parser = mod.Parser || mod;

async function test() {
    if (typeof Parser.init !== 'function') {
        console.error('Parser.init is not a function. Exports:', mod);
        return;
    }
    await Parser.init();
    const parser = new Parser();
    const lang = await Parser.Language.load('/home/dima/Desktop/md-str-parser/markdown-stream-parser/public/tree-sitter-markdown-inline.wasm');
    parser.setLanguage(lang);

    const texts = [
        '*italic star*',
        '_italic underscore_',
        'normal *italic* normal',
        '*partial'
    ];

    for (const text of texts) {
        const tree = parser.parse(text);
        console.log(`\nText: "${text}"`);
        console.log(tree.rootNode.toString());

        const emphasis = tree.rootNode.descendantsOfType('emphasis');
        if (emphasis.length > 0) {
            const node = emphasis[0];
            console.log('Emphasis delimiters:');
            node.children.forEach(c => {
                if (c.type === 'emphasis_delimiter') {
                    console.log(`- "${c.text}" (${c.type})`);
                }
            });
        }
    }
}

test().catch(console.error);
