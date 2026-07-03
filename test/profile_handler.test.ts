const mockSend = jest.fn();
const mockPutCommand = jest.fn().mockImplementation(function (this: any, input) {
    this.input = input;
});

jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}), { virtual: true });

jest.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: jest.fn(() => ({ send: mockSend })),
    },
    PutCommand: mockPutCommand,
}), { virtual: true });

const { handler } = require('../assets/lambda-functions/profile_handler.js');

describe('profile handler', () => {
    beforeEach(() => {
        mockSend.mockReset();
        mockPutCommand.mockClear();
    });

    test('creates a profile and returns 201', async () => {
        mockSend.mockResolvedValueOnce({});

        const response = await handler({
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'user-123',
                        email: 'person@example.com',
                    },
                },
            },
            body: JSON.stringify({
                displayName: 'Pat',
            }),
        });

        expect(response.statusCode).toBe(201);
        expect(JSON.parse(response.body)).toEqual({
            sub: 'user-123',
            displayName: 'Pat',
            email: 'person@example.com',
            createdAt: expect.any(String),
        });
        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            input: expect.objectContaining({
                TableName: process.env.PROFILE_TABLE,
                ConditionExpression: 'attribute_not_exists(sub)',
                Item: expect.objectContaining({
                    sub: 'user-123',
                    displayName: 'Pat',
                    email: 'person@example.com',
                }),
            }),
        }));
    });

    test('returns 409 when profile already exists', async () => {
        mockSend.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });

        const response = await handler({
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'user-123',
                        email: 'person@example.com',
                    },
                },
            },
            body: JSON.stringify({
                displayName: 'Pat',
            }),
        });

        expect(response.statusCode).toBe(409);
        expect(JSON.parse(response.body)).toEqual({
            error: 'Profile already exists',
        });
    });

    test('returns 400 when required data is missing', async () => {
        const response = await handler({
            requestContext: {
                authorizer: {
                    claims: {
                        sub: 'user-123',
                        email: 'person@example.com',
                    },
                },
            },
            body: JSON.stringify({}),
        });

        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.body)).toEqual({
            error: 'displayName and authenticated email are required',
        });
        expect(mockSend).not.toHaveBeenCalled();
    });
});
