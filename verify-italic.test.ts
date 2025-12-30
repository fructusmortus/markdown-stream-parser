
import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownStreamParser } from './src/tree-sitter-markdown-stream-parser.ts';

describe('Inline Italic Verification', () => {
    let parser: MarkdownStreamParser;

    beforeEach(async () => {
        const path = require('path');
        const wasmPath = path.resolve(__dirname, 'demo/svelte-demo/static/tree-sitter-markdown.wasm');
        MarkdownStreamParser.configureWasmPath(wasmPath);

        parser = await MarkdownStreamParser.getInstance('test-italic-' + Date.now());
        parser.startParsing();
    });

    it('should strip asterisk markers from italic text', (done) => {
        const segments: any[] = [];
        parser.subscribeToTokenParse((seg) => {
            if (seg.status === 'STREAMING' && seg.segment) {
                segments.push(seg.segment);
            } else if (seg.status === 'END_STREAM') {
                try {
                    // Check logic
                    const textSegments = segments.filter(s => s.type === 'paragraph');
                    expect(textSegments.length).toBeGreaterThan(0);

                    // Reconstruct text
                    const fullText = textSegments.map(s => s.segment).join('');
                    expect(fullText).toContain('italic text');
                    expect(fullText).not.toContain('*italic text*');

                    // Check styles
                    const italicSegment = textSegments.find(s => s.segment === 'italic text');
                    expect(italicSegment).toBeDefined();
                    expect(italicSegment.styles).toContain('italic');

                    done();
                } catch (e) {
                    done(e);
                }
            }
        });

        parser.parseToken('normal ');
        parser.parseToken('*italic text*');
        parser.parseToken(' normal');
        setTimeout(() => parser.stopParsing(), 100);
    });

    it('should strip underscore markers from italic text', (done) => {
        const segments: any[] = [];
        parser.subscribeToTokenParse((seg) => {
            if (seg.status === 'STREAMING' && seg.segment) {
                segments.push(seg.segment);
            } else if (seg.status === 'END_STREAM') {
                try {
                    const textSegments = segments.filter(s => s.type === 'paragraph');
                    const fullText = textSegments.map(s => s.segment).join('');
                    expect(fullText).toContain('underscore text');
                    expect(fullText).not.toContain('_underscore text_');

                    const italicSegment = textSegments.find(s => s.segment === 'underscore text');
                    expect(italicSegment).toBeDefined();
                    expect(italicSegment.styles).toContain('italic');

                    done();
                } catch (e) {
                    done(e);
                }
            }
        });

        parser.parseToken('normal ');
        parser.parseToken('_underscore text_');
        parser.parseToken(' normal');
        setTimeout(() => parser.stopParsing(), 100);
    });
});
