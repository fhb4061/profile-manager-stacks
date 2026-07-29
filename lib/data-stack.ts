import { aws_dynamodb } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

type DataStackProps = cdk.StackProps & {
    prefix: string;
}

export class DataStack extends cdk.Stack {
    public readonly profileTable: aws_dynamodb.Table;

    constructor(scope: Construct, id: string, props: DataStackProps) {
        super(scope, id, props);

        // no explicit tableName: CFN-generated names can't collide with the legacy
        // backend-stack table during migration, and avoid rename/export deadlocks later
        this.profileTable = new aws_dynamodb.Table(this, `${props.prefix}-table`, {
            partitionKey: { name: 'sub', type: aws_dynamodb.AttributeType.STRING },
            billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        new cdk.CfnOutput(this, 'TableName', {
            value: this.profileTable.tableName,
            description: 'DynamoDB table backing profiles (CFN-generated name)',
        });
    }
}
