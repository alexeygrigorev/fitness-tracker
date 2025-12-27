/**
 * Local deployment script for LocalStack
 * Deploys Lambda functions and DynamoDB tables
 */

import { LambdaClient, CreateFunctionCommand, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// LocalStack configuration
const LOCALSTACK_ENDPOINT = 'http://localhost:4566';
const region = 'eu-west-1';

const clients = {
  lambda: new LambdaClient({
    endpoint: LOCALSTACK_ENDPOINT,
    region,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
  dynamodb: new DynamoDBClient({
    endpoint: LOCALSTACK_ENDPOINT,
    region,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
  s3: new S3Client({
    endpoint: LOCALSTACK_ENDPOINT,
    region,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    forcePathStyle: true,
  }),
};

// Lambda function configurations
const lambdaFunctions = [
  {
    name: 'parseWorkout',
    handler: 'index.handler',
    zipPath: join(__dirname, '../amplify/backend/function/parseWorkout/dist/bundle.zip'),
    description: 'Parse workout descriptions using AI',
  },
  {
    name: 'parseFood',
    handler: 'index.handler',
    zipPath: join(__dirname, '../amplify/backend/function/parseFood/dist/bundle.zip'),
    description: 'Parse food descriptions using AI',
  },
  {
    name: 'generateAdvice',
    handler: 'index.handler',
    zipPath: join(__dirname, '../amplify/backend/function/generateAdvice/dist/bundle.zip'),
    description: 'Generate personalized fitness advice',
  },
  {
    name: 'transcribeVoice',
    handler: 'index.handler',
    zipPath: join(__dirname, '../amplify/backend/function/transcribeVoice/dist/bundle.zip'),
    description: 'Transcribe voice input using Whisper API',
  },
  {
    name: 'analyzeFoodPhoto',
    handler: 'index.handler',
    zipPath: join(__dirname, '../amplify/backend/function/analyzeFoodPhoto/dist/bundle.zip'),
    description: 'Analyze food photos using Vision API',
  },
];

// DynamoDB table configurations
const dynamoTables = [
  {
    name: 'UserWorkout',
    keySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }, { AttributeName: 'startTime', KeyType: 'RANGE' }],
    attributes: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'startTime', AttributeType: 'S' },
    ],
  },
  {
    name: 'UserMeal',
    keySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }, { AttributeName: 'timestamp', KeyType: 'RANGE' }],
    attributes: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' },
    ],
  },
  {
    name: 'UserSleep',
    keySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }, { AttributeName: 'date', KeyType: 'RANGE' }],
    attributes: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'date', AttributeType: 'S' },
    ],
  },
  {
    name: 'UserProfile',
    keySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    attributes: [
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
  },
  {
    name: 'CanonicalExercise',
    keySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }],
    attributes: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
  },
  {
    name: 'CanonicalFood',
    keySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }],
    attributes: [
      { AttributeName: 'pk', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
  },
];

async function createLambdaFunction(name: string, handler: string, zipPath: string, description: string) {
  try {
    // Check if function exists
    await clients.lambda.send(new GetFunctionCommand({ FunctionName: name }));
    console.log(`Lambda ${name} already exists, skipping...`);
    return;
  } catch {
    // Function doesn't exist, create it
  }

  try {
    const zipFile = readFileSync(zipPath);

    await clients.lambda.send(new CreateFunctionCommand({
      FunctionName: name,
      Runtime: 'nodejs20.x',
      Role: 'arn:aws:iam::000000000000:role/lambda-role',
      Handler: handler,
      Code: { ZipFile: zipFile },
      Description: description,
      Timeout: 30,
      MemorySize: 256,
      Environment: {
        Variables: {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
          AWS_REGION: region,
        },
      },
    }));

    console.log(`Created Lambda function: ${name}`);
  } catch (error: any) {
    console.error(`Error creating Lambda ${name}:`, error.message);
  }
}

async function createDynamoTable(name: string, keySchema: any[], attributes: any[]) {
  try {
    const existing = await clients.dynamodb.send(new ListTablesCommand({}));
    if (existing.TableNames?.includes(name)) {
      console.log(`DynamoDB table ${name} already exists, skipping...`);
      return;
    }
  } catch {
    // Continue
  }

  try {
    await clients.dynamodb.send(new CreateTableCommand({
      TableName: name,
      KeySchema: keySchema,
      AttributeDefinitions: attributes,
      BillingMode: 'PAY_PER_REQUEST',
    }));

    console.log(`Created DynamoDB table: ${name}`);
  } catch (error: any) {
    console.error(`Error creating table ${name}:`, error.message);
  }
}

async function createS3Bucket() {
  const bucketName = 'fitness-tracker-local-storage';

  try {
    await clients.s3.send(new CreateBucketCommand({
      Bucket: bucketName,
    }));
    console.log(`Created S3 bucket: ${bucketName}`);
  } catch (error: any) {
    if (error.name !== 'BucketAlreadyOwnedByYou' && error.name !== 'BucketAlreadyExists') {
      console.error(`Error creating S3 bucket:`, error.message);
    } else {
      console.log(`S3 bucket ${bucketName} already exists`);
    }
  }
}

async function deploy() {
  console.log('🚀 Starting LocalStack deployment...\n');

  // Create S3 bucket for storage
  await createS3Bucket();
  console.log('');

  // Create DynamoDB tables
  console.log('Creating DynamoDB tables...');
  for (const table of dynamoTables) {
    await createDynamoTable(table.name, table.keySchema, table.attributes);
  }
  console.log('');

  // Create Lambda functions
  console.log('Creating Lambda functions...');
  for (const fn of lambdaFunctions) {
    await createLambdaFunction(fn.name, fn.handler, fn.zipPath, fn.description);
  }
  console.log('');

  console.log('✅ LocalStack deployment complete!');
  console.log('\nAvailable endpoints:');
  console.log(`  - LocalStack: ${LOCALSTACK_ENDPOINT}`);
  console.log(`  - DynamoDB Admin: http://localhost:8001`);
}

deploy().catch(console.error);
