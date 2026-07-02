const { convertCents, formatCents } = require('../../../src/domain/money');
const { ValidationError } = require('../../../src/domain/errors');

describe('convertCents', () => {
    const rates = { USD: 1, EUR: 0.92, GBP: 0.79 };

    test('converts using the supplied rate and rounds to the nearest cent', () => {
        const cents = convertCents(4999, "GBP", rates);
        expect(cents).toBe(3949);
    });

    test('returns the amount unchanged when target currency is USD', () => {
        expect(convertCents(4999, "USD", rates)).toBe(4999);
        expect(convertCents(4999, "USD", undefined)).toBe(4999);
    });

    test('rounds half-cent results to the nearest cent', () => {
        expect(convertCents(100, "EUR", { EUR: 0.505 })).toBe(51);
    });

    test('throws TypeError when amountCents is not an integer', () => {
        expect(() => convertCents(49.99, "EUR", rates)).toThrow(TypeError);
    });

    test('throws ValidationError when the currency is missing from rates', () => {
        expect(() => convertCents(100, "JPY", rates)).toThrow(ValidationError);
    });

    test('throws ValidationError when rates is not provided', () => {
        expect(() => convertCents(100, "EUR", undefined)).toThrow(ValidationError);
    });

    test('throws ValidationError when the rate is zero or negative', () => {
        expect(() => convertCents(100, "EUR", { EUR: 0 })).toThrow(ValidationError);
        expect(() => convertCents(100, "EUR", { EUR: -0.5 })).toThrow(ValidationError);
    });

    test('throws ValidationError when the rate is not a finite number', () => {
        expect(() => convertCents(100, "EUR", { EUR: NaN })).toThrow(ValidationError);
        expect(() => convertCents(100, "EUR", { EUR: "0.92" })).toThrow(ValidationError);
    });
});

describe('Test Format cents', () => {
    test('Test with ideal input', () => {
        expect(formatCents(-50)).toBe(`-0.50`);
        expect(formatCents(50)).toBe(`0.50`);
        expect(formatCents(100)).toBe(`1.00`);
        expect(formatCents(-100)).toBe(`-1.00`);
        expect(formatCents(0)).toBe(`0.00`);
    })

    test('pads single-digit cents with a leading zero', () => {
        expect(formatCents(5)).toBe('0.05');
        expect(formatCents(-5)).toBe('-0.05');
        expect(formatCents(105)).toBe('1.05');
    });

    test('handles amounts spanning multiple whole-currency digits', () => {
        expect(formatCents(123456)).toBe('1234.56');
        expect(formatCents(-123456)).toBe('-1234.56');
    });

    test('treats negative zero as zero', () => {
        expect(formatCents(-0)).toBe('0.00');
    });

    test('throws TypeError when amountCents is not an integer', () => {
        expect(() => formatCents(50.5)).toThrow(TypeError);
    });

    test('throws TypeError when amountCents is not a number', () => {
        expect(() => formatCents('50')).toThrow(TypeError);
        expect(() => formatCents(undefined)).toThrow(TypeError);
    });

})