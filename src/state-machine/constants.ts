'use strict'

export const BLOCK_TYPES: Record<string, string> = {
    header: 'header',
    paragraph: 'paragraph',
    codeBlock: 'codeBlock',
    blockQuote: 'blockQuote',
}

export const REGEX: Record<string, RegExp> = {
    hasNewLineSymbol:                         /(\n|\\n)+/,
    endsWithNewLine:                          /(?:\\n|\n)[ \t]*$/,
    endsWithMoreThanOneNewLine:               /(?:\\n|\n){2,}[ \t]*$/,

    headerMarker:                             /^(#{1,6}\s?)(.*)/,    // Matches sequence of `#` (1-6 length) followed by one empty space

    italicMarkerPartialOrFull:                /^([^*]*)(\*)([^\s*](?:[^*]*[^\s*])?)(\*)?([^*]*)$/,        // Doesn't check for brackets before the backtick
    italicMarkerFull:                         /^([^*]*)(\*)([^\s*](?:[^*]*[^\s*])?)(\*)([^*]*)$/,
    italicMarkerPartialStart:                 /^( *)(\*)([^\s*](?:[^*]*[^\s*])?)([^*]*)$/,  // For now allows whitespace before the first asterisk
    italicMarkerPartialEnd:                   /^(\s*\S+)(\*)([\s\S]*)$/,

    boldMarkerPartialOrFull:                  /^([^*]*)(\*\*)([^\s*](?:[^*]*[^\s*])?)(\*\*)?([^*]*)$/,        // Doesn't check for brackets before the backtick
    boldMarkerFull:                           /^([^*]*)(\*\*)([^\s*](?:[^*]*[^\s*])?)(\*\*)([^*]*)$/,
    boldMarkerPartialStart:                   /^( *)(\*\*)([^\s*](?:[^*]*[^\s*])?)([^*]*)$/,  // For now allows whitespace before the first double asterisk
    boldMarkerPartialEnd:                     /^(\s*\S+)(\*\*)([\s\S]*)$/,

    boldItalicMarkerPartialOrFull:            /^([^*]*)(\*\*\*)([^\s*](?:[^*]*[^\s*])?)(\*\*\*)?([^*]*)$/,        // Doesn't check for brackets before the backtick
    boldItalicMarkerFull:                     /^([^*]*)(\*\*\*)([^\s*](?:[^*]*[^\s*])?)(\*\*\*)([^*]*)$/,
    boldItalicMarkerPartialStart:             /^( *)(\*\*\*)([^\s*](?:[^*]*[^\s*])?)([^*]*)$/,  // For now allows whitespace before the first triple asterisk
    boldItalicMarkerPartialEnd:               /^(\s*\S+)(\*\*\*)([\s\S]*)$/,

    strikethroughMarkerPartialOrFull:         /^([^~]*)(~~)([^\s~](?:[^~]*[^\s~])?)(~~)?([^~]*)$/,        // Doesn't check for brackets before the backtick
    strikethroughMarkerFull:                  /^([^~]*)(~~)([^\s~](?:[^~]*[^\s~])?)(~~)([^~]*)$/,
    strikethroughMarkerPartialStart:          /^( *)(~~)([^\s~](?:[^~]*[^\s~])?)([^~]*)$/,  // For now allows whitespace before the first double tilde
    strikethroughMarkerPartialEnd:            /^(\s*\S+)(~~)([\s\S]*?)$/,

    inlineCodeMarkerPartialOrFull:            /^([^`]*)(`)([^\s`](?:[^`]*[^\s`])?)(`)?([^`]*)$/,        // Doesn't check for brackets before the backtick
    inlineCodeMarkerFull:                     /^([^`]*)(`)([^\s`](?:[^`]*[^\s`])?)(`)([^`]*)$/,
    inlineCodeMarkerPartialStart:             /^( *)(`)([^\s`](?:[^`]*[^\s`])?)([^`]*)$/, // For now allows whitespace before the first backtick
    inlineCodeMarkerPartialEnd:               /^(\s*\S+)(`)([\s\S]*)$/,

    codeBlockStartMarker:                     /^(\s*```)([a-zA-Z_+-]*)(?:\n|\\n)([a-zA-Z_+\-\s]*)$/, // triple backticks followed by language name and new line. ```JavaScript\n, only letters, numbers, underscores, plus and minus signs are allowed
    codeBlockEndMarker:                       /(?<!`)```(?!`)\s*((\n|\\n){1,})/,      // [```\n\n]  or [``` \n\n] or [ ``` \n\n] or [ ``` \n]
}

export const INLINE_STYLE_GROUPS: Record<string, {
    name: string;
    regex: {
        partialOrFull: RegExp;
        full: RegExp;
        partialStart: RegExp;
        partialEnd: RegExp;
    };
    styles: string[];
}> = {
    italic: {
        name: 'italic',
        regex: {
            partialOrFull: REGEX.italicMarkerPartialOrFull,
            full: REGEX.italicMarkerFull,
            partialStart: REGEX.italicMarkerPartialStart,
            partialEnd: REGEX.italicMarkerPartialEnd,
        },
        styles: ['italic']
    },
    bold: {
        name: 'bold',
        regex: {
            partialOrFull: REGEX.boldMarkerPartialOrFull,
            full: REGEX.boldMarkerFull,
            partialStart: REGEX.boldMarkerPartialStart,
            partialEnd: REGEX.boldMarkerPartialEnd,
        },
        styles: ['bold']
    },
    boldItalic: {
        name: 'boldItalic',
        regex: {
            partialOrFull: REGEX.boldItalicMarkerPartialOrFull,
            full: REGEX.boldItalicMarkerFull,
            partialStart: REGEX.boldItalicMarkerPartialStart,
            partialEnd: REGEX.boldItalicMarkerPartialEnd,
        },
        styles: ['bold', 'italic']
    },
    strikethrough: {
        name: 'strikethrough',
        regex: {
            partialOrFull: REGEX.strikethroughMarkerPartialOrFull,
            full: REGEX.strikethroughMarkerFull,
            partialStart: REGEX.strikethroughMarkerPartialStart,
            partialEnd: REGEX.strikethroughMarkerPartialEnd,
        },
        styles: ['strikethrough']
    },
    inlineCode: {
        name: 'inlineCode',
        regex: {
            partialOrFull: REGEX.inlineCodeMarkerPartialOrFull,
            full: REGEX.inlineCodeMarkerFull,
            partialStart: REGEX.inlineCodeMarkerPartialStart,
            partialEnd: REGEX.inlineCodeMarkerPartialEnd,
        },
        styles: ['code']
    },
}
