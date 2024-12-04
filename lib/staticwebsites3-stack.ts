import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';


export interface CustomStackProps extends cdk.StackProps {
  bucketName: string;
  requestLogging: boolean;
}


export class Staticwebsites3Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CustomStackProps) {
    super(scope, id, props);
    
    let filedir:string;

    const sites = ['admin', 'web'];
        
   
   
    sites.forEach(site => {

      if (site == 'admin') {
        filedir = './admin'
        } else if (site == 'web') {
          filedir = './web'}

      
    const siteBucket = new s3.Bucket(this, `SiteBucket-${site}`, {
      bucketName:`${props.bucketName}-${site}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Use RETAIN for production
      autoDeleteObjects: true, // For testing; disable for production
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      serverAccessLogsBucket: props.requestLogging ? new s3.Bucket(this, `${site}-LoggingBucket`, {
        bucketName: `${props.bucketName}-${site}-logs`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }) : undefined,
    });

   
    const originAccessControl = new cloudfront.CfnOriginAccessControl(this, `OAC-${site}`, {
      originAccessControlConfig: {
        name: `${site}OAC`,
        signingBehavior: 'always', // Always sign requests
        originAccessControlOriginType: 's3', // Must match the S3 origin type
        signingProtocol: 'sigv4',
      },
    });

    // cloudfront
    const distribution = new cloudfront.CfnDistribution(this, `SiteDistribution-${site}`, {
      distributionConfig: {
        enabled: true,
        origins: [
          {
            id: `${site}-S3Origin`,
            domainName: siteBucket.bucketRegionalDomainName,
            originAccessControlId: originAccessControl.attrId, // Attach the OAC
            s3OriginConfig: {}, // Required for S3 origin with OAC
          },
        ],
        defaultCacheBehavior: {
          targetOriginId: `${site}-S3Origin`,
          viewerProtocolPolicy: 'redirect-to-https',
          allowedMethods: ['GET', 'HEAD'],
          cachedMethods: ['GET', 'HEAD'],
          forwardedValues: {
            queryString: false,
            cookies: { forward: 'none' },
          },
        },
        defaultRootObject: 'index.html',
      },
    });

    //  permissions to the S3 bucket
    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [siteBucket.arnForObjects('*')],
        principals: [
          new iam.ServicePrincipal('cloudfront.amazonaws.com', {
            conditions: {
              StringEquals: {
                'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.ref}`,
              },
            },
          }),
        ],
      })
    );

    // Add BucketDeployment to deploy static files and invalidate cache
    new s3deploy.BucketDeployment(this, `DeployWithInvalidation-${site}`, {
      sources: [s3deploy.Source.asset(filedir)], // Path to your static website files
      destinationBucket: siteBucket,
      distribution: cloudfront.Distribution.fromDistributionAttributes(this, `${site}-DistributionRef`, {
        distributionId: distribution.ref,
        domainName: distribution.attrDomainName,
      }),
      distributionPaths: ['/*'], // Invalidate all paths
    });

    // Output the CloudFront URL
    new cdk.CfnOutput(this, `${site}-CloudFrontURL`, {
      value: `https://${distribution.attrDomainName}`,
      description: 'The CloudFront Distribution URL for the website',
    });
  });
  }
}
