import TokensStreamBuffer from './tokens-stream-buffer.ts'
import Parser from 'tree-sitter';
import Markdown from '@tree-sitter-grammars/tree-sitter-markdown';

interface StreamingSegment {
    level?: number;
    segment: string;
    styles: string[];
    type: string;
    isBlockDefining: boolean;
    isProcessingNewLine: boolean;
}

export interface StreamingChunk {
    status: string;
    segment: StreamingSegment;
}

interface BlockState {
    type: string;
    level?: number;
    startIndex: number;
    lastSegmentEnd: number;
    styles: Set<string>;
}


export class MarkdownStreamParser {
    private static instances = new Map<string, MarkdownStreamParser>();
    
    private parser: Parser;
    private currentTree: Parser.Tree | null = null;
    private content: string = '';
    private lastProcessedIndex: number = 0;
    private currentBlock: BlockState | null = null;
    private allSegments: StreamingChunk[] = [];
    
    // Integration with TokensStreamBuffer
    private tokensStreamProcessor: TokensStreamBuffer;
    private parsing: boolean = false;
    private tokenParseListeners: Array<(chunk: StreamingChunk) => void> = [];
    private unsubscribeFromProcessor: (() => void) | null = null;
    
    static getInstance(instanceId: string): MarkdownStreamParser {
        if (!MarkdownStreamParser.instances.has(instanceId)) {
            MarkdownStreamParser.instances.set(instanceId, new MarkdownStreamParser());
        }
        
        console.info(`\x1b[34mMarkdownStreamParser ->\x1b[0m getInstance::instanceId: ${instanceId}`);
        return MarkdownStreamParser.instances.get(instanceId)!;
    }
    
    static removeInstance(instanceId: string): void {
        const instance = MarkdownStreamParser.instances.get(instanceId);
        if (instance) {
            instance.stopParsing();
            MarkdownStreamParser.instances.delete(instanceId);
        }
    }
    
    constructor() {
        this.parser = new Parser();
        this.parser.setLanguage(Markdown);
        this.tokensStreamProcessor = new TokensStreamBuffer();
    }
    
    /**
    * Subscribe to parsed tokens/segments
    * Returns an unsubscribe function
    */
    subscribeToTokenParse(listener: (chunk: StreamingChunk, unsubscribe: () => void) => void): () => void {
        const wrappedListener = (data: StreamingChunk) => {
            listener(data, unsubscribe);
        };
        
        const unsubscribe = () => {
            this.tokenParseListeners = this.tokenParseListeners.filter(l => l !== wrappedListener);
        };
        
        this.tokenParseListeners.push(wrappedListener);
        return unsubscribe;
    }
    
    /**
    * Notify all subscribers about a parsed token
    */
    private notifyTokenParse(chunk: StreamingChunk): void {
        this.tokenParseListeners.forEach(listener => listener(chunk));
    }
    
    /**
    * Start the parsing session
    */
    startParsing(): void {
        if (this.parsing) {
            console.warn('Parser is already running');
            return;
        }
        
        // Reset state
        this.reset();
        
        // Notify start
        this.notifyTokenParse({ status: 'START_STREAM' });
        
        // Subscribe to completed segments from TokensStreamBuffer
        this.unsubscribeFromProcessor = this.tokensStreamProcessor.subscribeToSegmentCompletion((word: string) => {
            // Process the completed word/segment through tree-sitter
            const segments = this.processRawChunk(word);
            
            // Notify listeners about each segment
            segments.forEach(segment => {
                this.notifyTokenParse(segment);
            });
        });
        
        this.parsing = true;
        console.info('\x1b[32mParser started\x1b[0m');
    }
    
    /**
    * Parse a single token/chunk
    */
    parseToken(chunk: string): Error | void {
        if (!this.parsing) {
            const error = new Error('Parser is not started. Call startParsing() first.');
            console.error('\x1b[31mMarkdownStreamParser::parseToken::error\x1b[0m', error.message);
            return error;
        }
        
        // Send chunk to the token buffer for processing
        this.tokensStreamProcessor.receiveChunk(chunk);
    }
    
    /**
    * Stop parsing and cleanup
    */
    stopParsing(): void {
        if (!this.parsing) {
            return;
        }
        
        // Flush any remaining content in the buffer
        this.tokensStreamProcessor.flushBuffer();
        
        // Unsubscribe from token processor
        if (this.unsubscribeFromProcessor) {
            this.unsubscribeFromProcessor();
            this.unsubscribeFromProcessor = null;
        }
        
        // Notify end
        this.notifyTokenParse({ status: 'END_STREAM' });
        
        this.parsing = false;
        console.info('\x1b[32mParser stopped\x1b[0m');
    }
    
    /**
    * Process raw chunk through tree-sitter
    */
    private processRawChunk(chunk: string): StreamingChunk[] {
        const oldLength = this.content.length;
        
        // Add chunk to content
        this.content += chunk;
        
        // Update last processed index
        this.lastProcessedIndex = this.content.length;
        
        // Parse the updated content
        this.currentTree = this.parser.parse(this.content);
        
        // Generate segments for the new content
        const newSegments = this.generateSegments(oldLength, this.content.length);
        
        // Store all segments for debugging
        this.allSegments.push(...newSegments);
        
        return newSegments;
    }
    
    private generateSegments(fromIndex: number, toIndex: number): StreamingChunk[] {
        if (!this.currentTree) return [];
        
        const segments: StreamingChunk[] = [];
        const newContent = this.content.substring(fromIndex, toIndex);
        
        // Skip empty content
        if (!newContent) return segments;
        
        // First, check the content itself for markdown patterns
        const contentType = this.analyzeContentType(this.content, fromIndex);
        
        // Determine if this is truly a new block
        let isNewBlock = false;
        if (contentType) {
            isNewBlock = !this.currentBlock || 
            this.currentBlock.type !== contentType.type ||
            (contentType.level !== undefined && this.currentBlock.level !== contentType.level);
        }
        
        // If we detected a specific markdown pattern, use it
        if (contentType) {
            const segment: StreamingChunk = {
                status: "STREAMING",
                segment: {
                    segment: newContent,
                    styles: [],
                    type: contentType.type,
                    isBlockDefining: isNewBlock,
                    isProcessingNewLine: newContent.includes('\n'),
                    ...(contentType.level !== undefined && { level: contentType.level })
                }
            };
            
            segments.push(segment);
            
            // Update current block tracking only if it's a new block
            if (isNewBlock) {
                this.currentBlock = {
                    type: contentType.type,
                    level: contentType.level,
                    startIndex: fromIndex,
                    lastSegmentEnd: toIndex,
                    styles: new Set()
                };
            } else if (this.currentBlock) {
                this.currentBlock.lastSegmentEnd = toIndex;
            }
            
            return segments;
        }
        
        // Find the deepest node containing the new content position
        const nodeAtPosition = this.findActiveNodeAtPosition(this.currentTree.rootNode, fromIndex);
        
        if (!nodeAtPosition) {
            // If no node found, treat as plain text
            return [{
                status: "STREAMING",
                segment: {
                    segment: newContent,
                    styles: [],
                    type: "text",
                    isBlockDefining: false,
                    isProcessingNewLine: newContent.includes('\n')
                }
            }];
        }
        
        // Determine the block type and properties
        const blockInfo = this.getBlockInfo(nodeAtPosition);
        
        // Check if we're starting a new block
        isNewBlock = this.isNewBlock(blockInfo, nodeAtPosition);
        
        // Detect styles in the current context
        const styles = this.detectActiveStyles(nodeAtPosition, fromIndex, toIndex);
        
        // Create the segment
        const segment: StreamingChunk = {
            status: "STREAMING",
            segment: {
                segment: newContent,
                styles: styles,
                type: blockInfo.type,
                isBlockDefining: isNewBlock,
                isProcessingNewLine: newContent.includes('\n'),
                ...(blockInfo.level !== undefined && { level: blockInfo.level })
            }
        };
        
        segments.push(segment);
        
        // Update current block tracking
        if (isNewBlock) {
            this.currentBlock = {
                type: blockInfo.type,
                level: blockInfo.level,
                startIndex: nodeAtPosition.startIndex,
                lastSegmentEnd: toIndex,
                styles: new Set(styles)
            };
        } else if (this.currentBlock) {
            this.currentBlock.lastSegmentEnd = toIndex;
            styles.forEach(s => this.currentBlock!.styles.add(s));
        }
        
        return segments;
    }
    
    private analyzeContentType(
        content: string, 
        position: number
    ): { type: string; level?: number } | null {
        // Get the current line being built
        const beforeContent = content.substring(0, position);
        const afterContent = content.substring(position);
        
        // Find the start of the current line
        const lastNewline = beforeContent.lastIndexOf('\n');
        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
        const currentLineContent = content.substring(lineStart, position + afterContent.length);
        
        // Check for heading markers at line start
        if (lineStart === position || lastNewline === position - 1 || position === 0) {
            // We're at the beginning of a line or document
            const headingMatch = currentLineContent.match(/^(#{1,6})(\s|$)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                return { type: 'header', level };
            }
        } else if (currentLineContent.match(/^(#{1,6})\s/)) {
            // We're in the middle of a heading line
            const headingMatch = currentLineContent.match(/^(#{1,6})\s/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                return { type: 'header', level };
            }
        }
        
        // Check for code block markers
        if (currentLineContent.match(/^```/)) {
            return { type: 'code_block' };
        }
        
        // Check for list markers
        if (currentLineContent.match(/^(\*|-|\+|\d+\.)\s/)) {
            return { type: 'list_item' };
        }
        
        // Check for blockquote markers
        if (currentLineContent.match(/^>/)) {
            return { type: 'blockquote' };
        }
        
        return null;
    }
    
    private findActiveNodeAtPosition(node: Parser.SyntaxNode, position: number): Parser.SyntaxNode | null {
        if (position < node.startIndex || position > node.endIndex) {
            return null;
        }
        
        for (const child of node.children) {
            const childResult = this.findActiveNodeAtPosition(child, position);
            if (childResult) {
                return childResult;
            }
        }
        
        return node;
    }
    
    private getBlockInfo(node: Parser.SyntaxNode): { type: string; level?: number } {
        let current: Parser.SyntaxNode | null = node;
        
        while (current) {
            switch (current.type) {
                case 'atx_heading':
                return { 
                    type: 'header', 
                    level: this.getHeadingLevel(current) 
                };
                case 'paragraph':
                return { type: 'paragraph' };
                case 'fenced_code_block':
                return { type: 'code_block' };
                case 'list_item':
                return { type: 'list_item' };
                case 'blockquote':
                return { type: 'blockquote' };
            }
            
            current = current.parent;
        }
        
        return { type: 'paragraph' };
    }
    
    private isNewBlock(blockInfo: { type: string; level?: number }, node: Parser.SyntaxNode): boolean {
        const blockNode = this.findBlockNode(node);
        if (!blockNode) return false;
        
        if (!this.currentBlock) return true;
        
        if (this.currentBlock.type !== blockInfo.type) return true;
        if (blockInfo.level !== undefined && this.currentBlock.level !== blockInfo.level) return true;
        
        if (blockNode.startIndex > this.currentBlock.lastSegmentEnd) return true;
        
        return false;
    }
    
    private findBlockNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
        let current: Parser.SyntaxNode | null = node;
        const blockTypes = ['atx_heading', 'paragraph', 'fenced_code_block', 'list_item', 'blockquote'];
        
        while (current) {
            if (blockTypes.includes(current.type)) {
                return current;
            }
            current = current.parent;
        }
        
        return null;
    }
    
    private detectActiveStyles(node: Parser.SyntaxNode, startIdx: number, endIdx: number): string[] {
        const styles: Set<string> = new Set();
        let current: Parser.SyntaxNode | null = node;
        
        while (current) {
            if (current.type === 'strong_emphasis' || current.type === 'strong') {
                styles.add('bold');
            } else if (current.type === 'emphasis' || current.type === 'em') {
                styles.add('italic');
            } else if (current.type === 'code_span') {
                styles.add('inline_code');
            } else if (current.type === 'strikethrough') {
                styles.add('strikethrough');
            }
            
            current = current.parent;
        }
        
        return Array.from(styles);
    }
    
    private getHeadingLevel(node: Parser.SyntaxNode): number {
        for (const child of node.children) {
            if (child.type.startsWith('atx_h') && child.type.endsWith('_marker')) {
                const match = child.type.match(/atx_h(\d)_marker/);
                if (match) {
                    return parseInt(match[1], 10);
                }
            }
        }
        
        const text = node.text || '';
        const match = text.match(/^(#{1,6})\s/);
        if (match) {
            return match[1].length;
        }
        
        return 1;
    }
    
    getCurrentContent(): string {
        return this.content;
    }
    
    getAllSegments(): StreamingChunk[] {
        return this.allSegments;
    }
    
    getSegmentsSummary(): { total: number; byType: Record<string, number> } {
        const byType: Record<string, number> = {};
        
        this.allSegments.forEach(seg => {
            if (seg.segment) {
                const type = seg.segment.type;
                byType[type] = (byType[type] || 0) + 1;
            }
        });
        
        return {
            total: this.allSegments.length,
            byType
        };
    }
    
    reset(): void {
        this.content = '';
        this.currentTree = null;
        this.lastProcessedIndex = 0;
        this.currentBlock = null;
        this.allSegments = [];
    }
}
