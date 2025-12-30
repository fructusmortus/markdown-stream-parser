
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownStreamParser } from './src/tree-sitter-markdown-stream-parser.ts';

describe('Inline Italic Buffering Verification', () => {
    let parser: MarkdownStreamParser;

    beforeEach(async () => {
        const path = require('path');
        const wasmPath = path.resolve(__dirname, 'demo/svelte-demo/static/tree-sitter-markdown.wasm');
        MarkdownStreamParser.configureWasmPath(wasmPath);

        parser = await MarkdownStreamParser.getInstance('test-italic-buffer-' + Date.now());
        parser.startParsing();
    });

    it('should buffer split italic markers and strip them correctly', (done) => {
        const segments: any[] = [];
        parser.subscribeToTokenParse((seg) => {
            if (seg.status === 'STREAMING' && seg.segment) {
                segments.push(seg.segment);
            } else if (seg.status === 'END_STREAM') {
                try {
                    const textSegments = segments.filter(s => s.type === 'paragraph');
                    const fullText = textSegments.map(s => s.segment).join('');

                    // The bug reported: "*exceptional " (plain) + "musical..." (italic)
                    // We expect: "exceptional musical abilities" (all italic, no *)

                    console.log('Full text:', fullText);
                    console.log('Segments:', JSON.stringify(textSegments, null, 2));

                    expect(fullText).not.toContain('*');
                    expect(fullText).toContain('exceptional musical abilities');

                    // Check if *all* parts are italic (or at least the ones that should be)
                    // With correct buffering, it should be one or more segments, ALL italic
                    textSegments.forEach(s => {
                        // If it's whitespace, it might not have style, but the text parts should
                        if (s.segment.trim().length > 0) {
                            expect(s.styles).toContain('italic');
                        }
                    });

                    done();
                } catch (e) {
                    done(e);
                }
            }
        });

        // Simulate streaming character by character or small chunks
        // "*exceptional musical abilities*"
        // Chunk 1: "*excep" -> parser might emit "*excep" if not buffering
        parser.parseToken('He is known for his ');
        parser.parseToken('*excep');
        parser.parseToken('tional musical abilities*');
        parser.parseToken(' and more.');

        setTimeout(() => parser.stopParsing(), 200);
    });
});
