const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoDBClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function parseBody(event) {
    if (!event || !event.body) {
        return {};
    }

    if (typeof event.body === 'string') {
        return JSON.parse(event.body);
    }

    return event.body;
}

exports.handler = async (event) => {
    const claims = event?.requestContext?.authorizer?.claims ?? {};
    const body = parseBody(event);
    const sub = claims.sub;
    const email = claims.email;
    const displayName = body.displayName;
    const createdAt = new Date().toISOString();

    if (!sub || !email || !displayName) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'displayName and authenticated email are required',
            }),
        };
    }

    const profileItem = {
        sub,
        displayName,
        email,
        createdAt,
    };

    try {
        await dynamoDBClient.send(new PutCommand({
            TableName: process.env.PROFILE_TABLE,
            Item: profileItem,
            ConditionExpression: 'attribute_not_exists(sub)',
        }));

        return {
            statusCode: 201,
            body: JSON.stringify(profileItem),
        };
    } catch (error) {
        if (error?.name === 'ConditionalCheckFailedException') {
            return {
                statusCode: 409,
                body: JSON.stringify({
                    error: 'Profile already exists',
                }),
            };
        }

        console.error('Error processing profile:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Could not process profile' }),
        };
    }
};
