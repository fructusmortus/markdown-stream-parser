import { MarkdownStreamParser } from '../src/tree-sitter-markdown-stream-parser.ts'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

async function main() {
    // Configure WASM paths for Node.js environment
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const wasmDir = resolve(__dirname, 'svelte-demo/static')
    MarkdownStreamParser.configureWasmPath(
        `${wasmDir}/tree-sitter-markdown.wasm`,
        `${wasmDir}/tree-sitter-markdown-inline.wasm`
    )

    const parser = await MarkdownStreamParser.getInstance('test-bold-tree-sitter')

    parser.subscribeToTokenParse((token) => {
        console.log(JSON.stringify(token, null, 2))
    })

    parser.startParsing()

    const chunks = ['Here is ', '**bold**', ' text.']

    for (const chunk of chunks) {
        parser.parseToken(chunk)
    }

    parser.stopParsing()
}

main().catch(console.error)

