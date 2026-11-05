/**
 * Builds the object-prompt text a SAM API request sends as `input_text`: one
 * block per source frame, each an object id followed by a box and points. See
 * "SAM API input" in the protocol document. The builder only formats text; it
 * does not send requests, and the API remains the authority on which prompts it
 * accepts.
 */
/** A positive point marks part of the object; a negative point marks a region that is not. */
export type PromptPointLabel = 'positive' | 'negative';
/**
 * The media's width and height in pixels, as displayed after any rotation the
 * file specifies. Every prompt coordinate is in this space, so scale coordinates
 * from a scaled or cropped view to it before building the prompt.
 */
export interface PromptSize {
    readonly width: number;
    readonly height: number;
}
/**
 * A box with half-open `right` and `bottom`, the same shape as a parsed
 * `SegmentationBoxRecord`, so a parsed record can be passed as is.
 */
export interface PromptBox {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
}
export interface PromptPoint {
    readonly x: number;
    readonly y: number;
    /** Defaults to `'positive'`. */
    readonly label?: PromptPointLabel;
}
/** One object's prompts on one source frame. */
export interface FramePrompt {
    /** The zero-based source frame. Defaults to 0, the only frame of an image. */
    readonly frame?: number;
    readonly box?: PromptBox;
    readonly points?: readonly PromptPoint[];
}
export interface PromptObject {
    /**
     * The id the response reports the object under: a non-negative integer, or
     * its decimal string such as a parsed record's `objectId`.
     */
    readonly id: number | string;
    readonly prompts: readonly FramePrompt[];
}
export interface BuildObjectPromptOptions {
    readonly size: PromptSize;
    readonly objects: readonly PromptObject[];
}
export type ObjectPromptErrorCode = 'no_objects' | 'invalid_size' | 'invalid_object_id' | 'duplicate_object_id' | 'empty_object' | 'invalid_frame' | 'duplicate_frame' | 'empty_prompt' | 'invalid_box' | 'invalid_point' | 'invalid_point_label';
/** Thrown for input the builder cannot encode as object-prompt text. */
export declare class ObjectPromptError extends Error {
    readonly code: ObjectPromptErrorCode;
    constructor(message: string, code: ObjectPromptErrorCode);
}
/**
 * Builds object-prompt text for a SAM API request.
 *
 * Frames are emitted in ascending order, objects in input order within a frame,
 * and each object's box before its points. Throws `ObjectPromptError` for input
 * it cannot encode: a size or coordinate that is not a non-negative integer,
 * a box or point outside `size`, an empty box, an object or frame prompt with no
 * box and no points, or the same object or frame given twice.
 */
export declare function buildObjectPrompt(options: BuildObjectPromptOptions): string;
