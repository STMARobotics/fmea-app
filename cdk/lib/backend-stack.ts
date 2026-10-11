import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  public readonly apiFunctionUrl: lambda.IFunctionUrl;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table for season records.
    const table = new dynamodb.Table(this, 'AppDataTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production data
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const apiHandler = new nodejs.NodejsFunction(this, 'SeasonApiFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(__dirname, '../../service/src/season/router.handler.ts'),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(10),
    });
    table.grantReadWriteData(apiHandler);

    const functionUrl = apiHandler.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    });
    this.apiFunctionUrl = functionUrl;
  }
}