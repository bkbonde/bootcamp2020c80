# Neptune with Lambda

## Reading Material

- [Using AWS Lambda functions in Amazon Neptune](https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions.html)

## Steps to code

1. Create new directory using `mkdir step00_neptune_lambda`
2. Navigate to newly created directory using `cd step00_neptune_lambda`
3. Create cdk v1 app using `npx aws-cdk@1.x init app --language typescript`
4. use `npm run watch` to auto transpile the code
5. Install ec2 module using `npm i @aws-cdk/aws-ec2`. Update "./lib/step00_neptune_lambda-stack.ts" to define virtual private cloud which created subnet IPv4 addresses for our net-working.

   ```js
   const vpc = new ec2.Vpc(this, 'Vpc', {
     subnetConfiguration: [
       {
         cidrMask: 24,
         name: 'Ingress',
         subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
       },
     ],
   });
   ```

6. Update "./lib/step00_neptune_lambda-stack.ts" to create security group as AWS neptune requires one. Also create tag for security group and inbound rule.

   ```js
   const sg1 = new ec2.SecurityGroup(this, 'mySecurityGroup1', {
     vpc,
     allowAllOutbound: true,
     description: 'security group 1',
     securityGroupName: 'mySecurityGroup',
   });
   cdk.Tags.of(sg1).add('Name', 'mySecurityGroup');
   sg1.addIngressRule(sg1, ec2.Port.tcp(8182), 'MyRule');
   ```

7. Install neptune module using `npm i @aws-cdk/aws-neptune`.Update "./lib/step00_neptune_lambda-stack.ts" to create a subnet group.

   ```js
   const neptuneSubnet = new neptune.CfnDBSubnetGroup(
     this,
     'neptuneSubnetGroup',
     {
       dbSubnetGroupDescription: 'My Subnet',
       subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.ISOLATED })
         .subnetIds,
       dbSubnetGroupName: 'mysubnetgroup',
     }
   );
   ```

8. Update "./lib/step00_neptune_lambda-stack.ts" to create a naptune cluster which is also the database we are going to use. Also set that it depends on subnet

   ```js
   const neptuneCluster = new neptune.CfnDBCluster(this, 'MyCluster', {
     dbSubnetGroupName: neptuneSubnet.dbSubnetGroupName,
     dbClusterIdentifier: 'myDbCluster',
     vpcSecurityGroupIds: [sg1.securityGroupId],
   });
   neptuneCluster.addDependsOn(neptuneSubnet);
   ```

9. Update "./lib/step00_neptune_lambda-stack.ts" to create a naptune instance

   ```js
   const neptuneInstance = new neptune.CfnDBInstance(this, 'myinstance', {
     dbInstanceClass: 'db.t3.medium',
     dbClusterIdentifier: neptuneCluster.dbClusterIdentifier,
     availabilityZone: vpc.availabilityZones[0],
   });
   neptuneInstance.addDependsOn(neptuneCluster);
   ```

10. Install lambda module using `npm i @aws-cdk/aws-lambda`.Update "./lib/step00_neptune_lambda-stack.ts" to create a lambda function

    ```js
    const handler = new lambda.Function(this, 'Lambda', {
      runtime: lambda.Runtime.NODEJS_10_X,
      code: new lambda.AssetCode('lambdas/lambda1'),
      handler: 'index.handler',
      vpc: vpc,
      securityGroups: [sg1],
      environment: {
        NEPTUNE_ENDPOINT: neptuneCluster.attrEndpoint,
      },
      vpcSubnets: {
        subnetType: ec2.SubnetType.ISOLATED,
      },
    });
    ```

11. Install apigateway module using `npm i @aws-cdk/aws-apigateway`.Update "./lib/step00_neptune_lambda-stack.ts" to create an api gateway

    ```js
    const apigateway = new apigw.LambdaRestApi(this, 'api', {
      handler: handler,
    });
    ```

12. Update "./lib/step00_neptune_lambda-stack.ts" to display cluster endpoint in console

    ```js
    new cdk.CfnOutput(this, 'Neptune Endpoint', {
      value: neptuneCluster.attrEndpoint,
    });
    ```

13. Create new directory using `mkdir lambdas` navigate to it using `cd lambdas` create another directory `mkdir lambda1` and naviagte to it using `cd lambda1`
14. Intiate an npm project using `npm init --yes`
15. Install async and germlin using `npm i async@3.2.0` and `npm i gremlin@3.4.10` and respective types using `npm i @types/async@3.2.5 --save-dev`, `npm i @types/aws-lambda@8.10.72 --save-dev` and `npm i @types/gremlin@3.4.6 --save-dev`
16. Create "./lambdas/lambda1/index.ts" to define lambda handler code

    ```js
    import { driver, process as gprocess } from 'gremlin';
    import * as async from 'async';
    declare var process: {
      env: {
        NEPTUNE_ENDPOINT: string,
      },
    };
    let conn: driver.DriverRemoteConnection;
    let g: gprocess.GraphTraversalSource;
    async function query() {
      return g.V().limit(1).count().next();
    }
    async function doQuery() {
      let result = await query();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: result['value'],
      };
    }
    export async function handler() {
      const getConnectionDetails = () => {
        const database_url =
          'wss://' + process.env.NEPTUNE_ENDPOINT + ':8182/gremlin';
        return { url: database_url, headers: {} };
      };
      const createRemoteConnection = () => {
        const { url, headers } = getConnectionDetails();
        return new driver.DriverRemoteConnection(url, {
          mimeType: 'application/vnd.gremlin-v2.0+json',
          pingEnabled: false,
          headers: headers,
        });
      };
      const createGraphTraversalSource = (
        conn: driver.DriverRemoteConnection
      ) => {
        return gprocess.traversal().withRemote(conn);
      };
      if (conn == null) {
        conn = createRemoteConnection();
        g = createGraphTraversalSource(conn);
      }
      return async.retry(
        {
          times: 5,
          interval: 1000,
          errorFilter: function (err) {
            console.warn('Determining whether retriable error: ' + err.message);
            if (err.message.startsWith('WebSocket is not open')) {
              console.warn('Reopening connection');
              conn.close();
              conn = createRemoteConnection();
              g = createGraphTraversalSource(conn);
              return true;
            }
            if (err.message.includes('ConcurrentModificationException')) {
              console.warn(
                'Retrying query because of ConcurrentModificationException'
              );
              return true;
            }
            if (err.message.includes('ReadOnlyViolationException')) {
              console.warn(
                'Retrying query because of ReadOnlyViolationException'
              );
              return true;
            }
            return false;
          },
        },
        doQuery
      );
    }
    ```

17. Deploy the app using `npm run cdk deploy`
18. Destroy the app using `npm run cdk destroy`
