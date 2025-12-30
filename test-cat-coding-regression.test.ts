
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MarkdownStreamParser } from './src/tree-sitter-markdown-stream-parser.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Cat Coding Stream Regression', () => {
    let parser: MarkdownStreamParser;

    beforeEach(async () => {
        const wasmPath = path.resolve(__dirname, 'demo/svelte-demo/static/tree-sitter-markdown.wasm');
        MarkdownStreamParser.configureWasmPath(wasmPath);

        parser = await MarkdownStreamParser.getInstance('test-cat-coding-' + Date.now());
        parser.startParsing();
    });

    it('should render entire cat-coding stream without missing parts', (done) => {
        const segments: any[] = [];

        parser.subscribeToTokenParse((seg) => {
            if (seg.status === 'STREAMING' && seg.segment) {
                segments.push(seg.segment);
            } else if (seg.status === 'END_STREAM') {
                try {
                    // Reconstruct full text
                    const fullText = segments.map(s => s.segment).join('');

                    console.log('Full Text Length:', fullText.length);
                    console.log('Segments count:', segments.length);

                    // Check that key content is present
                    expect(fullText).toContain('cat_breeds');
                    expect(fullText).toContain('matched_breeds');
                    expect(fullText).toContain('find_cat_breeds');
                    expect(fullText).toContain('breed_pattern');
                    expect(fullText).toContain('Regex Pattern Explained');
                    expect(fullText).toContain('Challenge yourself next');

                    // Ensure nothing is stuck in buffer (should have reasonable segment count)
                    expect(segments.length).toBeGreaterThan(100);

                    done();
                } catch (e) {
                    done(e);
                }
            }
        });

        // Load and stream the actual chunks
        const chunksPath = path.resolve(__dirname, 'demo/llm-streams-examples/gpt-4.5-cat-coding.json');
        const chunks: string[] = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));

        chunks.forEach(chunk => parser.parseToken(chunk));

        setTimeout(() => parser.stopParsing(), 500);
    });
});
