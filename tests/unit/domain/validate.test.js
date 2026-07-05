const { isValidDate,
    validateNewUser,
    validateNewExpense,
    validateExpensePatch,
    validateBudget,
    validateCategory,
    validateMonth,
    validateCurrency,
    parseId,
    parsePagination } = require('../../../src/domain/validate');


describe('Test Validate.js methods', ()=>{
    test('Test isValidate', ()=>{
        expect(isValidDate('2022-01-32')).toBe(false);
        expect(isValidDate('2022-01-30')).toBe(true);
        expect(isValidDate('1000-01-01')).toBe(true);
        expect(isValidDate('2022-00-01')).toBe(false);
        expect(isValidDate('2022-01-00')).toBe(false);
        expect(isValidDate('2022-13-02')).toBe(false);
        expect(isValidDate('2024-02-29')).toBe(true);
        expect(isValidDate('2022-02-29')).toBe(false);
        expect(isValidDate('2022-08-31')).toBe(true);
        expect(isValidDate('2022-11-31')).toBe(false);
        expect(isValidDate('abcd-08-31')).toBe(false);
    });

    test('Test validateNewUser', ()=>{
        expect(require)
    })
    
});
