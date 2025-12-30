import { MarkdownStreamParser } from '../src/markdown-stream-parser.ts'

const parser = MarkdownStreamParser.getInstance('test-bold')

parser.subscribeToTokenParse((token) => {
    // We want to see if we get a token with style 'bold'
    console.log(JSON.stringify(token, null, 2))
})

parser.startParsing()

const chunks = ['**', 'bold**']

for (const chunk of chunks) {
    parser.parseToken(chunk)
}

parser.stopParsing()
