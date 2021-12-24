# Neptune with ec2

## Reading Material

- [Neptune](https://aws.amazon.com/neptune/)
- [Gremlin](https://tinkerpop.apache.org/gremlin.html)
- [Learn Gremlin](https://docs.janusgraph.org/getting-started/gremlin/)
- [You can find more queries here](https://www.sungardas.com/en-us/cto-labs-blog/a-beginners-walkthrough-for-building-and-querying-aws-neptune-with-gremlin/)
- [Use Lambda with Gremlin](https://docs.aws.amazon.com/neptune/latest/userguide/lambda-functions.html)
- [Generate Graph](https://aws.amazon.com/blogs/database/let-me-graph-that-for-you-part-1-air-routes/)

## Steps to code

1. Create new directory using `mkdir step01_neptune_ec2`
2. Navigate to newly created directory using `cd step01_neptune_ec2`
3. Create cdk v1 app using `npx aws-cdk@1.x init app --language typescript`
4. use `npm run watch` to auto transpile the code
5. Install s3 module using `npm i @aws-cdk/aws-s3`. Update "./lib/step01_neptune_ec2-stack.ts" to define a s3 bucket

   ```js
   import * as s3 from '@aws-cdk/aws-s3';
   const myBucket = new s3.Bucket(this, 'myBucket', {
     versioned: true,
   });
   ```

6. Install s3 deployment module using `npm i @aws-cdk/aws-s3-deployment`. Update "./lib/step01_neptune_ec2-stack.ts" to deploy sample data on s3 bucket

   ```js
   import * as s3deploy from '@aws-cdk/aws-s3-deployment';
   new s3deploy.BucketDeployment(this, 'DeployFiles', {
     sources: [s3deploy.Source.asset('./sampleData')],
     destinationBucket: myBucket,
   });
   ```

7. Create "./sampleData/file.txt" and "./sampleData/file2.txt" to create sample data.
8. Install IAM module using `npm i @aws-cdk/aws-iam`. Update "./lib/step01_neptune_ec2-stack.ts" to create an Iam role for ec2 so that it could access s3 and iam

   ```js
   import * as iam from '@aws-cdk/aws-iam';
   const role = new iam.Role(this, 'MyEc2', {
     assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
   });
   ```

9. Update "./lib/step01_neptune_ec2-stack.ts" to create policy for ec2 role and add oloicy to role

   ```js
   const policy = new iam.PolicyStatement({
     effect: iam.Effect.ALLOW,
     actions: [
       's3:*',
       'logs:*',
       'lambda:*',
       'cloudformation:*Stack',
       'ec2:*',
       'rds:*',
       'iam:*',
       'ssm:GetParameters',
     ],
     resources: ['*'],
   });
   role.addToPolicy(policy);
   ```

10. Install ec2 module using `npm i @aws-cdk/aws-ec2`. Update "./lib/step01_neptune_ec2-stack.ts" to create a VPC to configure ec2 instance and aws neptune database

    ```js
    import * as ec2 from '@aws-cdk/aws-ec2';
    const vpc = new ec2.Vpc(this, 'MyVpc', {
      maxAzs: 2,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'Public',
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });
    ```

11. Update "./lib/step01_neptune_ec2-stack.ts" to create Machine image for ec2 instance. This config is best suited for free tier

    ```js
    const amazonLinux = ec2.MachineImage.latestAmazonLinux({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
      edition: ec2.AmazonLinuxEdition.STANDARD,
      virtualization: ec2.AmazonLinuxVirt.HVM,
      storage: ec2.AmazonLinuxStorage.EBS,
    });
    ```

12. Update "./lib/step01_neptune_ec2-stack.ts" launch the instance with the following configuration and make sure to download the key-pair from ec2 dashboard before deploying the code

    ```js
    new ec2.Instance(this, 'MyInstance', {
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: amazonLinux,
      vpc,
      keyName: 'my-ec2-key',
      role,
    });
    ```

13. Update "./lib/step01_neptune_ec2-stack.ts" to create role for aws neptune

    ```js
    const roleA = new iam.Role(this, 'Myneptune', {
      assumedBy: new iam.ServicePrincipal('rds.amazonaws.com'),
    });
    ```

14. Update "./lib/step01_neptune_ec2-stack.ts" to configure policy for aws neptune so that it could access s3 and grant IAM permission to role

    ```js
    const policyA = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:*',
        'logs:*',
        'lambda:*',
        'cloudformation:*Stack',
        'ec2:*',
        'rds:*',
        'iam:*',
        'ssm:GetParameters',
      ],
      resources: ['*'],
    });
    roleA.addToPolicy(policyA);
    ```

15. Update "./lib/step01_neptune_ec2-stack.ts" to create security group as AWS neptune requires one. Also create tag for security group and inbound rule

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

16. Install neptune module using `npm i @aws-cdk/aws-neptune` Update "./lib/step01_neptune_ec2-stack.ts" to create a subnet group

    ```js
    import * as neptune from '@aws-cdk/aws-neptune';
    const neptuneSubnet = new neptune.CfnDBSubnetGroup(
      this,
      'neptuneSubnetGroup',
      {
        dbSubnetGroupDescription: 'My Subnet',
        subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC })
          .subnetIds,
        dbSubnetGroupName: 'mysubnetgroup',
      }
    );
    ```

17. Update "./lib/step01_neptune_ec2-stack.ts" to create naptune cluster

    ```js
    const neptuneCluster = new neptune.CfnDBCluster(this, 'MyCluster', {
      dbSubnetGroupName: neptuneSubnet.dbSubnetGroupName,
      dbClusterIdentifier: 'myDbCluster',
      vpcSecurityGroupIds: [sg1.securityGroupId],
    });
    neptuneCluster.addDependsOn(neptuneSubnet);
    ```

18. Update "./lib/step01_neptune_ec2-stack.ts" to create naptune instance

    ```js
    const neptuneInstance = new neptune.CfnDBInstance(this, 'myinstance', {
      dbInstanceClass: 'db.t3.medium',
      dbClusterIdentifier: neptuneCluster.dbClusterIdentifier,
      availabilityZone: vpc.availabilityZones[0],
    });
    neptuneInstance.addDependsOn(neptuneCluster);
    ```

19. Deploy the app using `npm run cdk deploy`
20. Destroy the app using `npm run cdk destroy`

## Steps to configure AWS Neptune in EC2

#### Step 1

- Connect to Your instance
- [Connect on Linux](https://docs.amazonaws.cn/en_us/AWSEC2/latest/UserGuide/AccessingInstancesLinux.html)
- [Connect on Windows](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/putty.html)

#### Step 2

- Export temporary aws credentials on EC2. [Create temporary Credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_use-resources.html#using-temp-creds-sdk-cli)

  ```
  export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
  export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  export AWS_SESSION_TOKEN=AQoDYXdzEJr1K...o5OytwEXAMPLE=`

  ```

#### Step 3

- Install Gremlin on EC2 instance [Install Gremlin Console from here](https://docs.aws.amazon.com/neptune/latest/userguide/access-graph-gremlin-console.html)

#### Step 4

- Go to AWS Neptune Console. Click on your database cluster. Under Action options you will find Manage Iam Permissions.
- Add the Iam role that you create using your stack and apply the role. This will take some time

#### Step 5

- Create a VPC Endpoint to allow s3 to access aws neptune resources
- [You can create vpc endpoint from here](https://docs.aws.amazon.com/neptune/latest/userguide/bulk-load-tutorial-IAM.html)
- Make sure that select your stack vpc and click all the route table options
- Alternatively you can also create the endpoint by specifying in the stack like

  ```typescript
  vpc.addGatewayEndpoint('gwep', {
    service: GatewayVpcEndpointAwsService.S3,
  });
  ```

#### Step 6

- Now go to EC2 dashboard and under security group add following rule on your main security group which is created automatically
  ![Inbound rules](https://github.com/panacloud-modern-global-apps/full-stack-serverless-cdk/raw/main/step51_greengrassv2/img/inbound_rules.png)

- Now go the security group that you created with name mySecurityGroup and add the inbound rule
- To add inbound rule click on the inboud rules > edit
- Next add rule and fill the field with following configuration
  Type -> Custom TCP
  Protocol -> TCP
  Port Range -> 8182
  Source -> Custom and add the security group id of your main security group
  Now Save

#### Step 7

- Run the following command from your EC2 instance

  ```
  curl -X POST \
      -H 'Content-Type: application/json' \
      https://your-neptune-endpoint:port/loader -d '
      {
        "source" : "s3://bucket-name/object-key-name",
        "format" : "format",
        "iamRoleArn" : "arn:aws:iam::account-id:role/role-name",
        "region" : "region",
        "failOnError" : "FALSE",
        "parallelism" : "MEDIUM",
        "updateSingleCardinalityProperties" : "FALSE",
        "queueRequest" : "TRUE",
      }'
  ```

#### Step 8

- Now run

  ```
  cd {your apache-tinker-folder}

  bin/gremlin.sh
  ```

- Gremlin console will pop up and now run the gremlin queries

- Sample queries

  ```
  1. gremlin> g.V().label().groupCount()

  ===> {continent=7, country=237, version=1, airport=3437}

  2. gremlin> g.V().has('code', 'ORD').valueMap(true)

  ==>{country=[US], code=[ORD], longest=[13000], id=18, city=[Chicago], lon=[-87.90480042], type=[airport], elev=[672], icao=[KORD], region=[US-IL], runways=[7], lat=[41.97859955], desc=[Chicago O'Hare International Airport], label=airport}
  ```
