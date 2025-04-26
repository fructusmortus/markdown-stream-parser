'use strict';

import { REGEX, INLINE_STYLE_GROUPS } from './constants.ts';

const isProcessingNewLine = (context, event, params) => context.isProcessingNewLine;
const isProcessingStylingMarkerSegment = (context, event, params) => context.isProcessingStylingMarkerSegment;
const isBlockTypeSet = (context, event, params) => context.blockType !== null && context.blockType !== undefined && context.blockType !== '';

const hasNewLine = (context, event, params) => REGEX.hasNewLineSymbol.test(event.segment);
const hasPrefixedContent = (context, event, params) => context.prefixedContent !== null && context.prefixedContent !== undefined && context.prefixedContent !== '';
const hasPostfixedContent = (context, event, params) => context.postfixedContent !== null && context.postfixedContent !== undefined && context.postfixedContent !== '';

const endsWithNewLine = (context, event, params) => REGEX.endsWithNewLine.test(event.segment);
const endsWithMoreThanOneNewLine = (context, event, params) => REGEX.endsWithMoreThanOneNewLine.test(event.segment);

const isHeaderMarker = (context, event, params) => REGEX.headerMarker.test(event.segment);    // Checks if string contains only consequent `#` followed by optional empty space ` `

const isInlineStyleMarkerPartialOrFull = (context, event, params) => INLINE_STYLE_GROUPS[params.styleGroup].regex.partialOrFull.test(event.segment);
const isInlineStyleMarkerFull = (context, event, params) => INLINE_STYLE_GROUPS[params.styleGroup].regex.full.test(event.segment);
const isInlineStyleMarkerPartialStart = (context, event, params) => INLINE_STYLE_GROUPS[params.styleGroup].regex.partialStart.test(event.segment);
const isInlineStyleMarkerPartialEnd = (context, event, params) => INLINE_STYLE_GROUPS[params.styleGroup].regex.partialEnd.test(event.segment);

const isCodeBlockStartMarker = (context, event, params) => REGEX.codeBlockStartMarker.test(event.segment);
const isCodeBlockEndMarker = (context, event, params) => REGEX.codeBlockEndMarker.test(event.segment);


const EVALUATIONS: Record<string, Function> = {
    'is::processingNewLine': isProcessingNewLine,
    'is::processingStylingMarkerSegment': isProcessingStylingMarkerSegment,

    'is::blockTypeSet': isBlockTypeSet,

    'is::headerMarker': isHeaderMarker,

    'is::inlineStyleMarkerPartialOrFull': isInlineStyleMarkerPartialOrFull,
    'is::inlineStyleMarkerFull': isInlineStyleMarkerFull,
    'is::inlineStyleMarkerPartialStart': isInlineStyleMarkerPartialStart,
    'is::inlineStyleMarkerPartialEnd': isInlineStyleMarkerPartialEnd,

    'is::codeBlockStartMarker': isCodeBlockStartMarker,
    'is::codeBlockEndMarker': isCodeBlockEndMarker,

    'has::newLine': hasNewLine,
    'has::prefixedContent': hasPrefixedContent,
    'has::postfixedContent': hasPostfixedContent,

    'ends::newLine': endsWithNewLine,
    'ends::moreThanOneNewLine': endsWithMoreThanOneNewLine,
}

export const evaluationRunner = (evaluationName, context, event, params) => {
    if (EVALUATIONS.hasOwnProperty(evaluationName) === false) {
        throw new Error(`No evaluation found for: ${evaluationName}`);
    }

    return EVALUATIONS[evaluationName](context, event, params);
}
