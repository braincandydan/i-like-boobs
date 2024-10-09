export declare type Direction = 'up' | 'down' | 'left' | 'right';
declare type DistanceCalculationMethod = 'center' | 'edges' | 'corners';
declare type DistanceCalculationFunction = (refCorners: Corners, siblingCorners: Corners, isVerticalDirection: boolean, distanceCalculationMethod: DistanceCalculationMethod) => number;
export declare const ROOT_FOCUS_KEY = "SN:ROOT";
export interface FocusableComponentLayout {
    left: number;
    top: number;
    readonly right: number;
    readonly bottom: number;
    width: number;
    height: number;
    x: number;
    y: number;
    node: HTMLElement;
}
interface CornerCoordinates {
    x: number;
    y: number;
}
interface Corners {
    a: CornerCoordinates;
    b: CornerCoordinates;
}
export declare type PressedKeys = {
    [index: string]: number;
};
/**
 * Extra details about pressed keys passed on the key events
 */
export interface KeyPressDetails {
    pressedKeys: PressedKeys;
}
/**
 * Extra details passed from outside to be bounced back on other callbacks
 */
export interface FocusDetails {
    event?: Event;
    nativeEvent?: Event;
    [key: string]: any;
}
export declare type BackwardsCompatibleKeyMap = {
    [index: string]: string | number | (number | string)[];
};
export declare type KeyMap = {
    [index: string]: (string | number)[];
};
export declare const init: ({ debug, visualDebug, nativeMode, throttle: throttleParam, throttleKeypresses, useGetBoundingClientRect, shouldFocusDOMNode, domNodeFocusOptions, shouldUseNativeEvents, rtl, distanceCalculationMethod, customDistanceCalculationFunction }?: {
    debug?: boolean;
    visualDebug?: boolean;
    nativeMode?: boolean;
    throttle?: number;
    throttleKeypresses?: boolean;
    useGetBoundingClientRect?: boolean;
    shouldFocusDOMNode?: boolean;
    domNodeFocusOptions?: {};
    shouldUseNativeEvents?: boolean;
    rtl?: boolean;
    distanceCalculationMethod?: DistanceCalculationMethod;
    customDistanceCalculationFunction?: DistanceCalculationFunction;
}) => void, setThrottle: ({ throttle: throttleParam, throttleKeypresses }?: {
    throttle?: number;
    throttleKeypresses?: boolean;
}) => void, destroy: () => void, setKeyMap: (keyMap: BackwardsCompatibleKeyMap) => void, setFocus: (focusKey: string, focusDetails?: FocusDetails) => void, navigateByDirection: (direction: string, focusDetails: FocusDetails) => void, pause: () => void, resume: () => void, updateAllLayouts: () => void, getCurrentFocusKey: () => string, doesFocusableExist: (focusKey: string) => boolean;
export {};
