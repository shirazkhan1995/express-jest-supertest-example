const { authenticate } = require('../../../src/middleware/auth');
const { UnauthorizedError } = require('../../../src/domain/errors');

describe('authenticate', () => {
    const expectedToken = 'dev-token';
    let middleware;
    let next;

    beforeEach(() => {
        middleware = authenticate(expectedToken);
        next = jest.fn();
    });

    function callWith(authorizationHeader) {
        const req = { headers: authorizationHeader === undefined ? {} : { authorization: authorizationHeader } };
        middleware(req, {}, next);
    }

    test('calls next with no arguments when the token matches', () => {
        callWith('Bearer dev-token');
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith();
    });

    test('rejects a missing authorization header', () => {
        callWith(undefined);
        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('rejects the wrong scheme', () => {
        callWith('Basic dev-token');
        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('rejects a lowercase scheme (case-sensitive match)', () => {
        callWith('bearer dev-token');
        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('rejects a header with no space between scheme and token', () => {
        callWith('Bearerdev-token');
        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('rejects a header with a double space (splits into an empty token)', () => {
        callWith('Bearer  dev-token');
        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('rejects an empty token', () => {
        callWith('Bearer ');
        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('rejects a token that does not match expectedToken', () => {
        callWith('Bearer wrong-token');
        expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    });

    test('rejection error has 401 status and UNAUTHORIZED code', () => {
        callWith('Basic dev-token');
        const err = next.mock.calls[0][0];
        expect(err.status).toBe(401);
        expect(err.code).toBe('UNAUTHORIZED');
    });
});