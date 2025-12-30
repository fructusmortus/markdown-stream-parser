
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownStreamParser } from './src/tree-sitter-markdown-stream-parser.ts';

describe('Real Stream Italic Reproduction', () => {
    let parser: MarkdownStreamParser;

    beforeEach(async () => {
        const path = require('path');
        const wasmPath = path.resolve(__dirname, 'demo/svelte-demo/static/tree-sitter-markdown.wasm');
        MarkdownStreamParser.configureWasmPath(wasmPath);

        parser = await MarkdownStreamParser.getInstance('test-real-italic-' + Date.now());
        parser.startParsing();
    });

    it('should correctly handle split italics in mythical people stream', (done) => {
        const segments: any[] = [];
        parser.subscribeToTokenParse((seg) => {
            if (seg.status === 'STREAMING' && seg.segment) {
                segments.push(seg.segment);
            } else if (seg.status === 'END_STREAM') {
                try {
                    const textSegments = segments.filter(s => s.type === 'paragraph');
                    const fullText = textSegments.map(s => s.segment).join('');

                    console.log('Full Text:', fullText);

                    // The problematic phrase
                    const targetPhrase = "exceptional musical abilities";

                    // Logic:
                    // 1. Should contain the phrase
                    expect(fullText).toContain(targetPhrase);

                    // 2. Should NOT contain the phrase with leading asterisk
                    expect(fullText).not.toContain('*' + targetPhrase);
                    expect(fullText).not.toContain('* ' + targetPhrase);

                    // 3. Should NOT contain the phrase with trailing asterisk
                    expect(fullText).not.toContain(targetPhrase + '*');

                    // 4. Verify style
                    // Find the segment containing "exceptional"
                    const italicSeg = textSegments.find(s => s.segment.includes('exceptional'));
                    expect(italicSeg).toBeDefined();
                    expect(italicSeg.styles).toContain('italic');

                    done();
                } catch (e) {
                    done(e);
                }
            }
        });

        // Exact chunks from the file
        const chunks = [
            " his immortality. The",
            " Count was also known for his *",
            "exceptional musical abilities* and claime"
        ];

        chunks.forEach(c => parser.parseToken(c));
        setTimeout(() => parser.stopParsing(), 200);
    });
});
