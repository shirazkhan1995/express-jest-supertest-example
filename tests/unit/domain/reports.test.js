const { monthRange, buildMonthlyReport } = require('../../../src/domain/reports');
const rates = { USD: 1, EUR: 0.92, GBP: 0.79 };
describe('monthRange', () => {
    test('returns the first and last day for a 31-day month', () => {
        expect(monthRange('2026-01')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
    });

    test('returns the first and last day for a 30-day month', () => {
        expect(monthRange('2026-04')).toEqual({ from: '2026-04-01', to: '2026-04-30' });
    });

    test('handles February in a non-leap year', () => {
        expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    });

    test('handles February in a leap year', () => {
        expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    });

    test('handles December without rolling over to the next year', () => {
        expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    });

    test('formats from/to as YYYY-MM-DD per spec date conventions', () => {
        const { from, to } = monthRange('2026-09');
        expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('buildMonthlyReport', () => {
    test('converts every category total into the requested currency', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'EUR',
            categoryTotals: [
                { category: 'entertainment', totalCents: 1000 },
                { category: 'food', totalCents: 2000 },
            ],
            budgets: [],
            rates: { EUR: 0.5 },
        });

        expect(report).toEqual({
            month: '2026-07',
            currency: 'EUR',
            totalCents: 1500,
            categories: [
                { category: 'entertainment', totalCents: 500 },
                { category: 'food', totalCents: 1000 },
            ],
            overBudgetCategories: [],
        });
    });

    test('attaches a converted budget only to categories present in categoryTotals', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'EUR',
            categoryTotals: [{ category: 'food', totalCents: 9000 }],
            // "transport" has a budget but no spend this month, so it must not appear at all.
            budgets: [
                { category: 'food', monthlyLimitCents: 10000 },
                { category: 'transport', monthlyLimitCents: 5000 },
            ],
            rates: { EUR: 0.5 },
        });

        expect(report.categories).toEqual([
            {
                category: 'food',
                totalCents: 4500,
                budget: { monthlyLimitCents: 5000, status: 'WARN' },
            },
        ]);
    });

    test('omits the budget key entirely for categories with no matching budget', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'USD',
            categoryTotals: [{ category: 'food', totalCents: 100 }],
            budgets: [],
            rates: { USD: 1 },
        });

        expect(report.categories[0]).not.toHaveProperty('budget');
    });

    test('computes budget status from the unconverted USD amounts', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'EUR',
            categoryTotals: [{ category: 'housing', totalCents: 12000 }],
            budgets: [{ category: 'housing', monthlyLimitCents: 10000 }],
            rates: { EUR: 0.5 },
        });

        // 12000 > 10000 in USD terms, even though the converted totalCents (6000) is well
        // under the converted limit (5000) would suggest otherwise if compared post-conversion.
        expect(report.categories[0].budget.status).toBe('OVER');
    });

    test('lists categories with OVER status in overBudgetCategories', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'USD',
            categoryTotals: [
                { category: 'food', totalCents: 500 },
                { category: 'housing', totalCents: 12000 },
            ],
            budgets: [
                { category: 'food', monthlyLimitCents: 10000 },
                { category: 'housing', monthlyLimitCents: 10000 },
            ],
            rates: { USD: 1 },
        });

        expect(report.overBudgetCategories).toEqual(['housing']);
    });

    test('treats spend under 80% of the limit as OK', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'USD',
            categoryTotals: [{ category: 'other', totalCents: 1000 }],
            budgets: [{ category: 'other', monthlyLimitCents: 10000 }],
            rates: { USD: 1 },
        });

        expect(report.categories[0].budget.status).toBe('OK');
    });

    // Per API.md: "spent is at least 80% of the limit (i.e. spent / limit >= 0.8)... Spending
    // exactly 80% of the limit is a WARN." Pins the boundary explicitly since the >= vs > choice
    // in budgetStatus (src/domain/budgets.js) is easy to get backwards.
    test('spec: spend at exactly 80% of the limit is a WARN', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'USD',
            categoryTotals: [{ category: 'food', totalCents: 8000 }],
            budgets: [{ category: 'food', monthlyLimitCents: 10000 }],
            rates: { USD: 1 },
        });

        expect(report.categories[0].budget.status).toBe('WARN');
    });

    test('totalCents is the sum of the already-converted category totals, not a conversion of the raw sum', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'EUR',
            categoryTotals: [
                { category: 'food', totalCents: 3 },
                { category: 'transport', totalCents: 3 },
            ],
            budgets: [],
            rates: { EUR: 0.5 },
        });

        // Each item rounds 3 * 0.5 = 1.5 up to 2, so the converted-then-summed total is 4.
        // Summing the raw cents first (6) and converting once would instead round to 3.
        expect(report.categories.map((c) => c.totalCents)).toEqual([2, 2]);
        expect(report.totalCents).toBe(4);
    });

    test('returns totalCents unchanged when currency is USD', () => {
        const report = buildMonthlyReport({
            month: '2026-07',
            currency: 'USD',
            categoryTotals: [{ category: 'food', totalCents: 12345 }],
            budgets: [],
            rates: { USD: 1 },
        });

        expect(report.totalCents).toBe(12345);
    });
});