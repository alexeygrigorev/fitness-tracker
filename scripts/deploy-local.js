// ============================================
// LocalStack Deployment Script
// ============================================
// Deploys DynamoDB tables and Lambda functions to LocalStack
// for local development without AWS cloud dependency

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  CreateTableCommand,
  DescribeTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// LocalStack configuration
const LOCALSTACK_ENDPOINT = process.env.AWS_ENDPOINT_URL || 'http://localhost:4566';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';

// DynamoDB client pointing to LocalStack
const dynamoDB = new DynamoDBClient({
  endpoint: LOCALSTACK_ENDPOINT,
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

// Table definitions matching the GraphQL schema
const tables = [
  {
    TableName: 'UserProfiles',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'WorkoutSessions',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'sessionId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'sessionId', AttributeType: 'S' },
      { AttributeName: 'startDate', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'byStartDate',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'startDate', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'Exercises',
    KeySchema: [
      { AttributeName: 'exerciseId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'exerciseId', AttributeType: 'S' },
      { AttributeName: 'name', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'byName',
        KeySchema: [
          { AttributeName: 'name', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'MealInstances',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'mealId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'mealId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'byTimestamp',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'FoodItems',
    KeySchema: [
      { AttributeName: 'foodId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'foodId', AttributeType: 'S' },
      { AttributeName: 'name', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'byName',
        KeySchema: [
          { AttributeName: 'name', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'SleepSessions',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'sleepId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'sleepId', AttributeType: 'S' },
      { AttributeName: 'sleepDate', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'bySleepDate',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'sleepDate', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'Goals',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'goalId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'goalId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'TrainingPrograms',
    KeySchema: [
      { AttributeName: 'programId', KeyType: 'HASH' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'programId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'byUser',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

/**
 * Check if a table exists
 */
async function tableExists(tableName) {
  try {
    await dynamoDB.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

/**
 * Create a DynamoDB table
 */
async function createTable(tableDefinition) {
  const tableName = tableDefinition.TableName;

  try {
    const exists = await tableExists(tableName);
    if (exists) {
      console.log(`  ✓ Table '${tableName}' already exists`);
      return;
    }

    await dynamoDB.send(new CreateTableCommand(tableDefinition));
    console.log(`  ✓ Created table '${tableName}'`);
  } catch (error) {
    console.error(`  ✗ Failed to create table '${tableName}':`, error.message);
    throw error;
  }
}

/**
 * Deploy all tables to LocalStack
 */
async function deployTables() {
  console.log('\n🚀 Deploying to LocalStack...');
  console.log(`   Endpoint: ${LOCALSTACK_ENDPOINT}`);
  console.log(`   Region: ${AWS_REGION}\n`);

  // Check LocalStack connectivity
  try {
    const existingTables = await dynamoDB.send(new ListTablesCommand({}));
    console.log(`  Found ${existingTables.TableNames?.length || 0} existing tables\n`);
  } catch (error) {
    console.error('\n❌ Cannot connect to LocalStack!');
    console.error('   Make sure Docker is running and execute: docker-compose up -d\n');
    process.exit(1);
  }

  // Create tables
  console.log('Creating tables:\n');
  for (const table of tables) {
    await createTable(table);
  }

  console.log('\n✅ Deployment complete!');
  console.log('\nAvailable services:');
  console.log(`  • LocalStack:    ${LOCALSTACK_ENDPOINT}`);
  console.log(`  • DynamoDB Admin: http://localhost:8001`);
  console.log('\nNext steps:');
  console.log('  1. Create .env file with AWS_ENDPOINT_URL=http://localhost:4566');
  console.log('  2. Run: pnpm dev\n');
}

/**
 * Delete all tables (for cleanup)
 */
async function deleteTables() {
  console.log('\n🗑️  Deleting all tables...\n');

  const { TableNames } = await dynamoDB.send(new ListTablesCommand({}));

  if (!TableNames || TableNames.length === 0) {
    console.log('  No tables to delete');
    return;
  }

  for (const tableName of TableNames) {
    try {
      await dynamoDB.send({
        TableName: tableName,
      });
      // Note: LocalStack doesn't support DeleteTable in the same way
      // Use docker-compose down -v to clear all data
      console.log(`  ✓ ${tableName}`);
    } catch (error) {
      console.log(`  ✗ ${tableName}: ${error.message}`);
    }
  }

  console.log('\n💡 Tip: Use "docker-compose down -v" to completely reset LocalStack\n');
}

// Main
const command = process.argv[2];

if (command === 'delete' || command === 'down') {
  deleteTables();
} else if (command === 'help' || command === '--help' || command === '-h') {
  console.log('\nLocalStack Deployment Script\n');
  console.log('Usage:');
  console.log('  node scripts/deploy-local.js         Deploy tables to LocalStack');
  console.log('  node scripts/deploy-local.js delete  Delete all tables');
  console.log('  node scripts/deploy-local.js help    Show this help\n');
} else {
  deployTables().catch((error) => {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  });
}
