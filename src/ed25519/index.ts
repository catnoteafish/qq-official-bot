/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
import {sha512, Message} from 'js-sha512';
import {randomBytes} from "crypto";
import {twistedEdwards} from './abstract/edwards';
import {Field, isNegativeLE, mod, pow2} from './abstract/modular';
import {Hex} from "@/ed25519/abstract/utils";
/**
 * ed25519 Twisted Edwards curve with following addons:
 * - X25519 ECDH
 * - Ristretto cofactor elimination
 * - Elligator hash-to-group / point indistinguishability
 */

const ED25519_P = BigInt(
    '57896044618658097711785492504343953926634992332820282019728792003956564819949'
);
// √(-1) aka √(a) aka 2^((p-1)/4)
const ED25519_SQRT_M1 = /* @__PURE__ */ BigInt(
    '19681161376707505956807079304988542015446066515923890162744021073123829784752'
);

// prettier-ignore
const _0n = BigInt(0), _1n = BigInt(1), _2n = BigInt(2), _3n = BigInt(3);
// prettier-ignore
const _5n = BigInt(5), _8n = BigInt(8);

function ed25519_pow_2_252_3(x: bigint) {
    // prettier-ignore
    const _10n = BigInt(10), _20n = BigInt(20), _40n = BigInt(40), _80n = BigInt(80);
    const P = ED25519_P;
    const x2 = (x * x) % P;
    const b2 = (x2 * x) % P; // x^3, 11
    const b4 = (pow2(b2, _2n, P) * b2) % P; // x^15, 1111
    const b5 = (pow2(b4, _1n, P) * x) % P; // x^31
    const b10 = (pow2(b5, _5n, P) * b5) % P;
    const b20 = (pow2(b10, _10n, P) * b10) % P;
    const b40 = (pow2(b20, _20n, P) * b20) % P;
    const b80 = (pow2(b40, _40n, P) * b40) % P;
    const b160 = (pow2(b80, _80n, P) * b80) % P;
    const b240 = (pow2(b160, _80n, P) * b80) % P;
    const b250 = (pow2(b240, _10n, P) * b10) % P;
    const pow_p_5_8 = (pow2(b250, _2n, P) * x) % P;
    // ^ To pow to (p+3)/8, multiply it by x.
    return {pow_p_5_8, b2};
}

function adjustScalarBytes(bytes: Uint8Array): Uint8Array {
    // Section 5: For X25519, in order to decode 32 random bytes as an integer scalar,
    // set the three least significant bits of the first byte
    bytes[0] &= 248; // 0b1111_1000
    // and the most significant bit of the last to zero,
    bytes[31] &= 127; // 0b0111_1111
    // set the second most significant bit of the last byte to 1
    bytes[31] |= 64; // 0b0100_0000
    return bytes;
}

// sqrt(u/v)
function uvRatio(u: bigint, v: bigint): { isValid: boolean; value: bigint } {
    const P = ED25519_P;
    const v3 = mod(v * v * v, P); // v³
    const v7 = mod(v3 * v3 * v, P); // v⁷
    // (p+3)/8 and (p-5)/8
    const pow = ed25519_pow_2_252_3(u * v7).pow_p_5_8;
    let x = mod(u * v3 * pow, P); // (uv³)(uv⁷)^(p-5)/8
    const vx2 = mod(v * x * x, P); // vx²
    const root1 = x; // First root candidate
    const root2 = mod(x * ED25519_SQRT_M1, P); // Second root candidate
    const useRoot1 = vx2 === u; // If vx² = u (mod p), x is a square root
    const useRoot2 = vx2 === mod(-u, P); // If vx² = -u, set x <-- x * 2^((p-1)/4)
    const noRoot = vx2 === mod(-u * ED25519_SQRT_M1, P); // There is no valid root, vx² = -u√(-1)
    if (useRoot1) x = root1;
    if (useRoot2 || noRoot) x = root2; // We return root2 anyway, for const-time
    if (isNegativeLE(x, P)) x = mod(-x, P);
    return {isValid: useRoot1 || useRoot2, value: x};
}

const Fp = /* @__PURE__ */ (() => Field(ED25519_P, undefined, true))();

const ed25519Defaults = /* @__PURE__ */ (() =>
    ({
        // Param: a
        a: BigInt(-1), // Fp.create(-1) is proper; our way still works and is faster
        // d is equal to -121665/121666 over finite field.
        // Negative number is P - number, and division is invert(number, P)
        d: BigInt('37095705934669439343138083508754565189542113879843219016388785533085940283555'),
        // Finite field 𝔽p over which we'll do calculations; 2n**255n - 19n
        Fp,
        // Subgroup order: how many points curve has
        // 2n**252n + 27742317777372353535851937790883648493n;
        n: BigInt('7237005577332262213973186563042994240857116359379907606001950938285454250989'),
        // Cofactor
        h: _8n,
        // Base point (x, y) aka generator point
        Gx: BigInt('15112221349535400772501151409588531511454012693041857206046113283949847762202'),
        Gy: BigInt('46316835694926478169428394003475163141307993866256225615783033603165251855960'),
        hash: (input: Message) => sha512.array(input),
        randomBytes,
        adjustScalarBytes,
        // dom2
        // Ratio of u to v. Allows us to combine inversion and square root. Uses algo from RFC8032 5.1.3.
        // Constant-time, u/√v
        uvRatio,
    }) as const)();
const ed25519 = twistedEdwards(ed25519Defaults);

export class Ed25519 {
    #privateKey: Hex
    get #publicKey(){
        return ed25519.getPublicKey(this.#privateKey)
    }
    constructor(secret: string) {
        while (secret.length < 32) secret = secret.repeat(2);
        secret = secret.slice(0, 32);
        this.#privateKey=Buffer.from(secret)
    }
    sign(message: string) {
        const content=Buffer.from(message,'utf8').toString('hex')
        const signResult=ed25519.sign(content, this.#privateKey)
        return Buffer.from(signResult.buffer).toString('hex')
    }
    verify(signature: Hex, message: string) {
        return ed25519.verify(signature, Buffer.from(message,'utf8'), this.#publicKey)
    }
}

/**
 * ed25519 curve with EdDSA signatures.
 */
export default ed25519
