import Parser from 'tree-sitter'
import Markdown from '@tree-sitter-grammars/tree-sitter-markdown';

export interface CompletedElement {
    type: string;
    text: string;
    level?: string;
}

export class MarkdownStreamParser {
    private parser: Parser;
    private currentTree: Parser.Tree | null = null;
    private content: string = '';
    private lineCount: number = 0;
    
    constructor() {
        this.parser = new Parser();
        this.parser.setLanguage(Markdown);
    }
    
    processLine(chunk: string): Parser.Tree {
        const oldContent = this.content;
        const oldLength = oldContent.length;
        
        // Don't add newlines automatically - let the content flow naturally
        this.content += chunk;
        
        // Track if this chunk ends with newline
        this.lastWasNewline = chunk.endsWith('\n');
        
        // Incremental parsing
        if (this.currentTree) {
            // Calculate positions based on actual content
            const lines = oldContent.split('\n');
            const startRow = lines.length - 1;
            const startCol = lines[lines.length - 1].length;
            
            const newLines = this.content.split('\n');
            const endRow = newLines.length - 1;
            const endCol = newLines[newLines.length - 1].length;
            
            this.currentTree.edit({
                startIndex: oldLength,
                oldEndIndex: oldLength,
                newEndIndex: this.content.length,
                startPosition: { row: startRow, column: startCol },
                oldEndPosition: { row: startRow, column: startCol },
                newEndPosition: { row: endRow, column: endCol }
            });
            
            this.currentTree = this.parser.parse(this.content, this.currentTree);
        } else {
            this.currentTree = this.parser.parse(this.content);
        }
        
        return this.currentTree;
    }
    
    private hasErrorInSubtree(node: Parser.SyntaxNode): boolean {
        if (node.type === 'ERROR' || node.type.includes('MISSING')) {
            return true;
        }
        
        for (const child of node.children) {
            if (this.hasErrorInSubtree(child)) {
                return true;
            }
        }
        
        return false;
    }
    
    private isNodeComplete(node: Parser.SyntaxNode): boolean {
        // Check if node has any ERROR nodes in its subtree
        const hasErrors = this.hasErrorInSubtree(node);
        
        // For code blocks, check if we have both delimiters
        if (node.type === 'fenced_code_block') {
            const delimiters = node.children.filter(child => 
                child.type === 'fenced_code_block_delimiter'
            );
            return delimiters.length >= 2 && !hasErrors;
        }
        
        // For paragraphs, they're complete if followed by a blank line or end of content
        if (node.type === 'paragraph') {
            // Check if there's a double newline after this paragraph
            const nodeEndIndex = node.endIndex;
            const afterNode = this.content.substring(nodeEndIndex);
            return !hasErrors && (afterNode.startsWith('\n\n') || afterNode === '' || afterNode === '\n');
        }
        
        // For other nodes, they're complete if no errors
        return !hasErrors;
    }
    
    getCompletedElements(): CompletedElement[] {
        if (!this.currentTree) return [];
        
        const completed: CompletedElement[] = [];
        const rootNode = this.currentTree.rootNode;
        
        // Find all headings
        const headings = rootNode.descendantsOfType('atx_heading');
        headings.forEach(heading => {
            if (this.isNodeComplete(heading)) {
                const inline = heading.children.find(c => c.type === 'inline');
                if (inline && inline.text) {
                    // Extract heading level from marker
                    const marker = heading.children.find(c => 
                        c.type.startsWith('atx_h') && c.type.includes('_marker')
                    );
                    const level = marker ? marker.type.match(/h(\d)/)?.[1] : '1';
                    
                    completed.push({
                        type: 'heading',
                        level: level,
                        text: inline.text
                    });
                }
            }
        });
        
        // Find completed paragraphs
        const paragraphs = rootNode.descendantsOfType('paragraph');
        paragraphs.forEach(para => {
            if (this.isNodeComplete(para) && para.text) {
                completed.push({
                    type: 'paragraph',
                    text: para.text
                });
            }
        });
        
        // Find completed code blocks
        const codeBlocks = rootNode.descendantsOfType('fenced_code_block');
        codeBlocks.forEach(block => {
            if (this.isNodeComplete(block) && block.text) {
                completed.push({
                    type: 'code_block',
                    text: block.text
                });
            }
        });
        
        return completed;
    }
    
    getCurrentTree(): Parser.Tree | null {
        return this.currentTree;
    }
    
    getContent(): string {
        return this.content;
    }
    
    debugTree(): void {
        if (!this.currentTree) return;
        
        console.log('\nCurrent tree structure:');
        console.log(this.currentTree.rootNode.toString());
    }
}
