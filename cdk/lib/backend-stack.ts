import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

interface BackendStackProps extends cdk.StackProps {
  googleClientId: string;
  allowedDomain: string;
}

export class BackendStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { googleClientId, allowedDomain } = props;
    if (!googleClientId?.trim() || !allowedDomain?.trim()) {
      throw new Error('Set googleClientId and allowedDomain in cdk/lib/config.ts before synthesis.');
    }

    // 1. DynamoDB Table
    const table = new dynamodb.Table(this, 'AppDataTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
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
    const createTeamHandler = this.createTeamFunction(
      'CreateTeamFunction',
      'create-team.handler.ts',
      table,
    );
    const listTeamsHandler = this.createTeamFunction(
      'ListTeamsFunction',
      'list-teams.handler.ts',
      table,
    );
    const getTeamHandler = this.createTeamFunction(
      'GetTeamFunction',
      'get-team.handler.ts',
      table,
    );
    const updateTeamHandler = this.createTeamFunction(
      'UpdateTeamFunction',
      'update-team.handler.ts',
      table,
    );
    const deleteTeamHandler = this.createTeamFunction(
      'DeleteTeamFunction',
      'delete-team.handler.ts',
      table,
    );
    const listSubsystemsHandler = this.createSubsystemFunction(
      'ListSubsystemsFunction',
      'list-subsystems.handler.ts',
      table,
    );
    const createSubsystemHandler = this.createSubsystemFunction(
      'CreateSubsystemFunction',
      'create-subsystem.handler.ts',
      table,
    );
    const updateSubsystemHandler = this.createSubsystemFunction(
      'UpdateSubsystemFunction',
      'update-subsystem.handler.ts',
      table,
    );
    const listFmeaEntriesHandler = this.createFmeaFunction(
      'ListFmeaEntriesFunction',
      'list-fmea-entries.handler.ts',
      table,
    );
    const getFmeaEntryHandler = this.createFmeaFunction(
      'GetFmeaEntryFunction',
      'get-fmea-entry.handler.ts',
      table,
    );
    const createFmeaEntryHandler = this.createFmeaFunction(
      'CreateFmeaEntryFunction',
      'create-fmea-entry.handler.ts',
      table,
    );
    const updateFmeaEntryHandler = this.createFmeaFunction(
      'UpdateFmeaEntryFunction',
      'update-fmea-entry.handler.ts',
      table,
    );
    const deleteFmeaEntryHandler = this.createFmeaFunction(
      'DeleteFmeaEntryFunction',
      'delete-fmea-entry.handler.ts',
      table,
    );
    const updateActionItemHandler = this.createFmeaFunction(
      'UpdateActionItemFunction',
      'update-action-item.handler.ts',
      table,
    );
    const deleteActionItemHandler = this.createFmeaFunction(
      'DeleteActionItemFunction',
      'delete-action-item.handler.ts',
      table,
    );
    const createActionItemHandler = this.createFmeaFunction(
      'CreateActionItemFunction',
      'create-action-item.handler.ts',
      table,
    );
    const replaceActionItemsHandler = this.createFmeaFunction(
      'ReplaceActionItemsFunction',
      'replace-action-items.handler.ts',
      table,
    );

    table.grantWriteData(createHandler);
    table.grantReadData(listHandler);
    table.grantReadData(getHandler);
    table.grantWriteData(updateHandler);
    table.grantReadWriteData(deleteHandler);
    table.grantWriteData(createTeamHandler);
    table.grantReadData(listTeamsHandler);
    table.grantReadData(getTeamHandler);
    table.grantWriteData(updateTeamHandler);
    table.grantWriteData(deleteTeamHandler);
    table.grantReadData(listSubsystemsHandler);
    table.grantReadWriteData(createSubsystemHandler);
    table.grantWriteData(updateSubsystemHandler);
    table.grantReadData(listFmeaEntriesHandler);
    table.grantReadData(getFmeaEntryHandler);
    table.grantReadWriteData(createFmeaEntryHandler);
    table.grantReadWriteData(updateFmeaEntryHandler);
    table.grantReadWriteData(deleteFmeaEntryHandler);
    table.grantReadWriteData(updateActionItemHandler);
    table.grantReadWriteData(deleteActionItemHandler);
    table.grantReadWriteData(createActionItemHandler);
    table.grantReadWriteData(replaceActionItemsHandler);

    const authorizerHandler = new nodejs.NodejsFunction(this, 'GoogleWorkspaceAuthorizer', {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, '../../service/src/auth/authorizer.handler.ts'),
      handler: 'handler',
      environment: {
        GOOGLE_CLIENT_ID: googleClientId,
        ALLOWED_DOMAIN: allowedDomain,
      },
      timeout: cdk.Duration.seconds(10),
    });
    const authorizer = new authorizers.HttpLambdaAuthorizer(
      'GoogleWorkspaceAuthorizer',
      authorizerHandler,
      {
        identitySource: ['$request.header.Authorization'],
        resultsCacheTtl: cdk.Duration.seconds(0),
        responseTypes: [authorizers.HttpLambdaResponseType.IAM],
      },
    );

    this.httpApi = new apigwv2.HttpApi(this, 'fmea-api', {
      defaultAuthorizer: authorizer,
    });

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
    this.httpApi.addRoutes({
      path: '/api/teams',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ListTeamsIntegration', listTeamsHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/teams',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateTeamIntegration', createTeamHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/teams/{teamId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetTeamIntegration', getTeamHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/teams/{teamId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration('UpdateTeamIntegration', updateTeamHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/teams/{teamId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('DeleteTeamIntegration', deleteTeamHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/subsystems/{teamId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ListSubsystemsIntegration', listSubsystemsHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/subsystems/{teamId}',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateSubsystemIntegration', createSubsystemHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/subsystems/{teamId}/{subsystemId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration('UpdateSubsystemIntegration', updateSubsystemHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/fmea/{teamId}/{seasonId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('ListFmeaEntriesIntegration', listFmeaEntriesHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/fmea/new',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateFmeaEntryIntegration', createFmeaEntryHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/fmea/{fmeaId}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration('GetFmeaEntryIntegration', getFmeaEntryHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/fmea/{fmeaId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration('UpdateFmeaEntryIntegration', updateFmeaEntryHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/fmea/{fmeaId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('DeleteFmeaEntryIntegration', deleteFmeaEntryHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/action-item/{actionItemId}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new integrations.HttpLambdaIntegration('UpdateActionItemIntegration', updateActionItemHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/action-item/{actionItemId}',
      methods: [apigwv2.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('DeleteActionItemIntegration', deleteActionItemHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/fmea/{fmeaId}/action-items',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('CreateActionItemIntegration', createActionItemHandler),
    });
    this.httpApi.addRoutes({
      path: '/api/fmea/{fmeaId}/action-items',
      methods: [apigwv2.HttpMethod.PUT],
      integration: new integrations.HttpLambdaIntegration('ReplaceActionItemsIntegration', replaceActionItemsHandler),
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
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, `../../service/src/season/${handlerFile}`),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(10),
    });
  }

  private createTeamFunction(
    id: string,
    handlerFile: string,
    table: dynamodb.ITable,
  ): nodejs.NodejsFunction {
    return new nodejs.NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, `../../service/src/team/${handlerFile}`),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(10),
    });
  }

  private createSubsystemFunction(
    id: string,
    handlerFile: string,
    table: dynamodb.ITable,
  ): nodejs.NodejsFunction {
    return new nodejs.NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, `../../service/src/subsystem/${handlerFile}`),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(10),
    });
  }

  private createFmeaFunction(
    id: string,
    handlerFile: string,
    table: dynamodb.ITable,
  ): nodejs.NodejsFunction {
    return new nodejs.NodejsFunction(this, id, {
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      entry: path.join(__dirname, `../../service/src/fmea/${handlerFile}`),
      handler: 'handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      timeout: cdk.Duration.seconds(10),
    });
  }
}