const { budgetStatus } = require('../../../src/domain/budgets');

describe('Test budget function', ()=>{
    test('Test non integer and negative values', ()=>{
        expect(()=>budgetStatus(0.9, 10)).toThrow('spentCents must be a non-negative integer');
        expect(()=>budgetStatus(-1, 10)).toThrow('spentCents must be a non-negative integer');

        expect(()=>budgetStatus(0.9, 0.2)).toThrow('limitCents must be a positive integer');
        expect(()=>budgetStatus(-1, -10)).toThrow('limitCents must be a positive integer');
    })

    test('Test at boundaries', ()=>{
        expect(budgetStatus(1, 2)).toBe("OK");
        expect(budgetStatus(2, 2)).toBe("WARN");
        expect(budgetStatus(3, 2)).toBe("OVER");
        expect(budgetStatus(32, 40)).toBe("WARN");
    })
})