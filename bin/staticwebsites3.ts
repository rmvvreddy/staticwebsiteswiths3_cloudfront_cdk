#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Staticwebsites3Stack } from '../lib/staticwebsites3-stack';
import { loadConfig } from '../lib/helper';

const app = new cdk.App();

const environment = app.node.tryGetContext('env');
if (!environment) {
  throw new Error('Please specify the environment using the context parameter (e.g., cdk deploy -c env=staging)');
}

const config = loadConfig(environment);

new Staticwebsites3Stack(app, 'Staticwebsites3Stack', {

  bucketName:config.bucketName,
  requestLogging:config.requestLogging,

});