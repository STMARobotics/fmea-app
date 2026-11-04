import { App, Stack, aws_dynamodb as ddb, aws_lambda as lambda } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { activityStream, configureActivityPublisher } from '../lib/activity-publisher';

test('FMEA activity capture is opt-in and sends only committed outbox INSERTs to its exact bus', () => {
  const app = new App({
    context: {
      activityIntegration: {
        orgId: 'example-team',
        busArn: 'arn:aws:events:us-east-2:111111111111:event-bus/activity',
        pipeEnabled: true,
        captureEnabled: true,
      },
    },
  });
  const stack = new Stack(app, 'activity', {
    env: { account: '111111111111', region: 'us-east-2' },
  });
  const table = new ddb.Table(stack, 'Table', {
    partitionKey: { name: 'pk', type: ddb.AttributeType.STRING },
    stream: activityStream(stack),
  });
  const fn = new lambda.Function(stack, 'Writer', {
    runtime: lambda.Runtime.NODEJS_24_X,
    handler: 'index.handler',
    code: lambda.Code.fromInline('exports.handler=async()=>{}'),
  });
  configureActivityPublisher(stack, table, [fn], 'fmea');
  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::Pipes::Pipe', {
    DesiredState: 'RUNNING',
    Target: 'arn:aws:events:us-east-2:111111111111:event-bus/activity',
  });
  const pipe = Object.values(template.findResources('AWS::Pipes::Pipe'))[0] as any;
  expect(
    JSON.parse(pipe.Properties.SourceParameters.FilterCriteria.Filters[0].Pattern),
  ).toMatchObject({
    eventName: ['INSERT'],
    dynamodb: { NewImage: { source: { S: ['fmea'] }, orgId: { S: ['example-team'] } } },
  });
  expect(pipe.Properties.TargetParameters.EventBridgeEventBusParameters.Source).toBe(
    'org.apps.fmea',
  );
  const disabled = new Stack(new App(), 'disabled', {
    env: { account: '111111111111', region: 'us-east-2' },
  });
  expect(activityStream(disabled)).toBeUndefined();
});
