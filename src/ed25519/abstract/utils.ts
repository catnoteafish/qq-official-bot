/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
// 100 lines of code in the file are duplicated from noble-hashes (utils).
// This is OK: `abstract` directory does not use noble-hashes.
// User may opt-in into using different hashing library. This way, noble-hashes
// won't be included into their bundle.
import {Message} from 'js-sha512'
const _0n = /* @__PURE__ */ BigInt(0);
const _1n = /* @__PURE__ */ BigInt(1);
const _2n = /* @__PURE__ */ BigInt(2);
export type Hex = Uint8Array | string; // hex strings are accepted for simplicity
export type FHash = (message: Message) => number[];

export function isBytes(a: unknown): a is Uint8Array {
    return a instanceof Uint8Array || (ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array');
}

export function abytes(item: unknown): void {
    if (!isBytes(item)) throw new Error('Uint8Array expected');
}

export function abool(title: string, value: boolean): void {
    if (typeof value !== 'boolean') throw new Error(title + ' boolean expected, got ' + value);
}

// Array where index 0xf0 (240) is mapped to string 'f0'
const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_, i) =>
    i.toString(16).padStart(2, '0')
);
/**
 * @example bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])) // 'cafe0123'
 */
export function bytesToHex(bytes: Uint8Array): string {
    abytes(bytes);
    // pre-caching improves the speed 6x
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += hexes[bytes[i]];
    }
    return hex;
}

export function hexToNumber(hex: string): bigint {
    if (typeof hex !== 'string') throw new Error('hex string expected, got ' + typeof hex);
    return hex === '' ? _0n : BigInt('0x' + hex); // Big Endian
}

// We use optimized technique to convert hex string to byte array
const asciis = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 } as const;
function asciiToBase16(ch: number): number | undefined {
    if (ch >= asciis._0 && ch <= asciis._9) return ch - asciis._0; // '2' => 50-48
    if (ch >= asciis.A && ch <= asciis.F) return ch - (asciis.A - 10); // 'B' => 66-(65-10)
    if (ch >= asciis.a && ch <= asciis.f) return ch - (asciis.a - 10); // 'b' => 98-(97-10)
    return;
}

/**
 * @example hexToBytes('cafe0123') // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
 */
export function hexToBytes(hex: string): Uint8Array {
    if (typeof hex !== 'string') throw new Error('hex string expected, got ' + typeof hex);
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2) throw new Error('hex string expected, got unpadded hex of length ' + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
        const n1 = asciiToBase16(hex.charCodeAt(hi));
        const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
        if (n1 === undefined || n2 === undefined) {
            const char = hex[hi] + hex[hi + 1];
            throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
        }
        array[ai] = n1 * 16 + n2; // multiply first octet, e.g. 'a3' => 10*16+3 => 160 + 3 => 163
    }
    return array;
}

// BE: Big Endian, LE: Little Endian
export function bytesToNumberBE(bytes: Uint8Array): bigint {
    return hexToNumber(bytesToHex(bytes));
}
export function bytesToNumberLE(bytes: Uint8Array): bigint {
    abytes(bytes);
    return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
}

export function numberToBytesBE(n: number | bigint, len: number): Uint8Array {
    return hexToBytes(n.toString(16).padStart(len * 2, '0'));
}
export function numberToBytesLE(n: number | bigint, len: number): Uint8Array {
    return numberToBytesBE(n, len).reverse();
}

/**
 * Takes hex string or Uint8Array, converts to Uint8Array.
 * Validates output length.
 * Will throw error for other types.
 * @param title descriptive title for an error e.g. 'private key'
 * @param hex hex string or Uint8Array
 * @param expectedLength optional, will compare to result array's length
 * @returns
 */
export function ensureBytes(title: string, hex: Hex, expectedLength?: number): Uint8Array {
    let res: Uint8Array;
    if (typeof hex === 'string') {
        try {
            res = hexToBytes(hex);
        } catch (e) {
            throw new Error(title + ' must be hex string or Uint8Array, cause: ' + e);
        }
    } else if (isBytes(hex)) {
        // Uint8Array.from() instead of hash.slice() because node.js Buffer
        // is instance of Uint8Array, and its slice() creates **mutable** copy
        res = Uint8Array.from(hex);
    } else {
        throw new Error(title + ' must be hex string or Uint8Array');
    }
    const len = res.length;
    if (typeof expectedLength === 'number' && len !== expectedLength)
        throw new Error(title + ' of length ' + expectedLength + ' expected, got ' + len);
    return res;
}

/**
 * Copies several Uint8Arrays into one.
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    let sum = 0;
    for (let i = 0; i < arrays.length; i++) {
        const a = arrays[i];
        abytes(a);
        sum += a.length;
    }
    const res = new Uint8Array(sum);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const a = arrays[i];
        res.set(a, pad);
        pad += a.length;
    }
    return res;
}


// Is positive bigint
const isPosBig = (n: bigint) => typeof n === 'bigint' && _0n <= n;

export function inRange(n: bigint, min: bigint, max: bigint) {
    return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}

/**
 * Asserts min <= n < max. NOTE: It's < max and not <= max.
 * @example
 * aInRange('x', x, 1n, 256n); // would assume x is in (1n..255n)
 */
export function aInRange(title: string, n: bigint, min: bigint, max: bigint) {
    // Why min <= n < max and not a (min < n < max) OR b (min <= n <= max)?
    // consider P=256n, min=0n, max=P
    // - a for min=0 would require -1:          `inRange('x', x, -1n, P)`
    // - b would commonly require subtraction:  `inRange('x', x, 0n, P - 1n)`
    // - our way is the cleanest:               `inRange('x', x, 0n, P)
    if (!inRange(n, min, max))
        throw new Error('expected valid ' + title + ': ' + min + ' <= n < ' + max + ', got ' + n);
}

// Bit operations

/**
 * Calculates amount of bits in a bigint.
 * Same as `n.toString(2).length`
 */
export function bitLen(n: bigint) {
    let len;
    for (len = 0; n > _0n; n >>= _1n, len += 1);
    return len;
}

/**
 * Calculate mask for N bits. Not using ** operator with bigints because of old engines.
 * Same as BigInt(`0b${Array(i).fill('1').join('')}`)
 */
export const bitMask = (n: number) => (_2n << BigInt(n - 1)) - _1n;

// Validating curves and fields

const validatorFns = {
    bigint: (val: any) => typeof val === 'bigint',
    function: (val: any) => typeof val === 'function',
    boolean: (val: any) => typeof val === 'boolean',
    string: (val: any) => typeof val === 'string',
    stringOrUint8Array: (val: any) => typeof val === 'string' || isBytes(val),
    isSafeInteger: (val: any) => Number.isSafeInteger(val),
    array: (val: any) => Array.isArray(val),
    field: (val: any, object: any) => (object as any).Fp.isValid(val),
    hash: (val: any) => typeof val === 'function' && Number.isSafeInteger(val.outputLen),
} as const;
type Validator = keyof typeof validatorFns;
type ValMap<T extends Record<string, any>> = { [K in keyof T]?: Validator };
// type Record<K extends string | number | symbol, T> = { [P in K]: T; }

export function validateObject<T extends Record<string, any>>(
    object: T,
    validators: ValMap<T>,
    optValidators: ValMap<T> = {}
) {
    const checkField = (fieldName: keyof T, type: Validator, isOptional: boolean) => {
        const checkVal = validatorFns[type];
        if (typeof checkVal !== 'function') throw new Error('invalid validator function');

        const val = object[fieldName as keyof typeof object];
        if (isOptional && val === undefined) return;
        if (!checkVal(val, object)) {
            throw new Error(
                'param ' + String(fieldName) + ' is invalid. Expected ' + type + ', got ' + val
            );
        }
    };
    for (const [fieldName, type] of Object.entries(validators)) checkField(fieldName, type!, false);
    for (const [fieldName, type] of Object.entries(optValidators)) checkField(fieldName, type!, true);
    return object;
}
/**
 * Memoizes (caches) computation result.
 * Uses WeakMap: the value is going auto-cleaned by GC after last reference is removed.
 */
export function memoized<T extends object, R, O extends any[]>(fn: (arg: T, ...args: O) => R) {
    const map = new WeakMap<T, R>();
    return (arg: T, ...args: O): R => {
        const val = map.get(arg);
        if (val !== undefined) return val;
        const computed = fn(arg, ...args);
        map.set(arg, computed);
        return computed;
    };
}
