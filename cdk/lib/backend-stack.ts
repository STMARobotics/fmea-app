import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export class BackendStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. DynamoDB Table
    const table = new dynamodb.Table(this, 'AppDataTable', {
      tableName: 'fmea',
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

    const createHandler = this.createSeasonFunction(
      'CreateSeasonFunction',
      'create-season.handler.ts',
      table,
    );
    const listHandler = this.createSeasonFunction(
      'ListSeasonsFunction',
      'list-seasons.handler.ts',
      table,
    );
    const getHandler = this.createSeasonFunction(
      'GetSeasonFunction',
      'get-season.handler.ts',
      table,
    );
    const updateHandler = this.createSeasonFunction(
      'UpdateSeasonFunction',
      'update-season.handler.ts',
      table,
    );
    const deleteHandler = this.createSeasonFunction(
      'DeleteSeasonFunction',
      'delete-season.handler.ts',
      table,
    );

    table.grantWriteData(createHandler);
    table.grantReadData(listHandler);
    table.grantReadData(getHandler);
    table.grantWriteData(updateHandler);
    table.grantReadWriteData(deleteHandler);

    this.httpApi = new apigwv2.HttpApi(this, 'fmea-api');

    this.httpApi.addRoutes({
      path: '/api/seasons',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ListSeasonsIntegration', listHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/seasons',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateSeasonIntegration', createHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/seasons/{seasonId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetSeasonIntegration', getHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/seasons/{seasonId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration('UpdateSeasonIntegration', updateHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/seasons/{seasonId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('DeleteSeasonIntegration', deleteHandler),
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.httpApi.apiEndpoint,
    });
  }

  private createSeasonFunction(
    id: string,
    handlerFile: string,
    table: dynamodb.ITable,
  ): nodejs.NodejsFunction {
    return new nodejs.NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      entry: path.join(__dirname, `../../service/src/season/${handlerFile}`),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(10),
    });
  }
}