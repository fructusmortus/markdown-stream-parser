'use strict';

import { REGEX, INLINE_STYLE_GROUPS } from './constants.ts';

import type { Context } from './markdown-state-machine.ts'

export type EvaluationParams = {
    styleGroup?: string
}

export type EvaluationEvent = {
    segment?: string
}

const EVALUATIONS: Record<string, Function> = {
    'is::processingNewLine': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => context.isProcessingNewLine,

    'is::processingStylingMarkerSegment': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => context.isProcessingStylingMarkerSegment,

    'is::blockTypeSet': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => context.blockType !== null && context.blockType !== undefined && context.blockType !== '',

    'is::headerMarker': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => REGEX.headerMarker.test(event.segment ?? ''),    // Checks if string contains only consequent `#` followed by optional empty space ` `

    'is::inlineStyleMarkerPartialOrFull': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => params.styleGroup ? INLINE_STYLE_GROUPS[params.styleGroup].regex.partialOrFull.test(event.segment ?? '') : false,

    'is::inlineStyleMarkerFull': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => params.styleGroup ? INLINE_STYLE_GROUPS[params.styleGroup].regex.full.test(event.segment ?? '') : false,

    'is::inlineStyleMarkerPartialStart': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => params.styleGroup ? INLINE_STYLE_GROUPS[params.styleGroup].regex.partialStart.test(event.segment ?? '') : false,

    'is::inlineStyleMarkerPartialEnd': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => params.styleGroup ? INLINE_STYLE_GROUPS[params.styleGroup].regex.partialEnd.test(event.segment ?? '') : false,

    'is::codeBlockStartMarker': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => REGEX.codeBlockStartMarker.test(event.segment ?? ''),

    'is::codeBlockEndMarker': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => REGEX.codeBlockEndMarker.test(event.segment ?? ''),

    'has::newLine': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => REGEX.hasNewLineSymbol.test(event.segment ?? ''),

    'has::prefixedContent': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => context.prefixedContent !== null && context.prefixedContent !== undefined && context.prefixedContent !== '',

    'has::postfixedContent': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => context.postfixedContent !== null && context.postfixedContent !== undefined && context.postfixedContent !== '',

    'ends::newLine': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => REGEX.endsWithNewLine.test(event.segment ?? ''),

    'ends::moreThanOneNewLine': (
        context: Context,
        event: EvaluationEvent,
        params: EvaluationParams
    ) => REGEX.endsWithMoreThanOneNewLine.test(event.segment ?? ''),
}

export const evaluationRunner = (
    evaluationName: string, // Accept any string
    context: Context,
    event: EvaluationEvent,
    params: EvaluationParams
) => {
    if (EVALUATIONS.hasOwnProperty(evaluationName) === false) {
        throw new Error(`No evaluation found for: ${evaluationName}`);
    }

    return EVALUATIONS[evaluationName](context, event, params);
}
