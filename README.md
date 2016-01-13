

# Simple Data Pipe (aka "Pipes")

The Simple Data Pipe is an app that moves your Salesforce or stripe.com data to dashDB, which is the IBM cloud data warehouse. Once you have your data in dashDB, you can do all kinds of analysis on it, with all kinds of tools, such as SQL, R, and Looker.

![Bluemix Deployments](https://deployment-tracker.mybluemix.net/stats/8c0fa6ec632fc1715cefebeaf0913740/badge.svg)

## Usage
To use the Simple Data Pipe, developers first grab the code on Github, and then deploy it to IBM Bluemix, where it runs. It lives at a URL in Bluemix, and comes complete with an AngularJS UI for connecting, scheduling, and reporting. We use the Salesforce OAuth to connect, and the powerful IBM DataWorks APIs to move the data.

To follow our full tutorial please visit : https://developer.ibm.com/clouddataservices/simple-data-pipe/

## Deploy to IBM Bluemix

The fastest way to deploy this application to Bluemix is to click the **Deploy to Bluemix** button below. If you prefer instead to deploy manually to Bluemix then read the entirety of this section.

[![Deploy to Bluemix](https://deployment-tracker.mybluemix.net/stats/8c0fa6ec632fc1715cefebeaf0913740/button.svg)](https://bluemix.net/deploy?repository=https://github.com/ibm-cds-labs/pipes)

**Don't have a Bluemix account?** If you haven't already, you'll be prompted to [sign up](http://www.ibm.com/cloud-computing/bluemix/) for a Bluemix account when you click the button.  Sign up, verify your email address, then return here and click the the **Deploy to Bluemix** button again. Your new credentials let you deploy to the platform and also to code online with Bluemix and Git. If you have questions about working in Bluemix, find answers in the [Bluemix Docs](https://www.ng.bluemix.net/docs/).

### Configuring Cloud Foundry

Complete these steps first if you have not already:

1. [Install the Cloud Foundry command line interface.](https://www.ng.bluemix.net/docs/#starters/install_cli.html)
2. Follow the instructions at the above link to connect to Bluemix.
3. Follow the instructions at the above link to log in to Bluemix.

### Creating Backing Services

Create a Cloudant service within Bluemix if one has not already been created:

    $ cf create-service cloudantNoSQLDB Shared pipes-cloudant-service

Create a dashDB service within Bluemix if one has not already been created:

    $ cf create-service dashDB Entry pipes-dashdb-service

Create a DataWorks service within Bluemix if one has not already been created:

    $ cf create-service DataWorks_Gen3 Starter pipes-dataworks-service

Create a Single Sign On (SSO) service within Bluemix if one has not already been created:

    $ cf create-service SingleSignOn standard pipes-sso-service

### Deploying

To deploy to Bluemix, simply:

    $ cf push

**Note:** You may notice that Bluemix assigns a URL to your application containing a random word. This is defined in the `manifest.yml` file where the `random-route` key set to the value of `true`. This ensures that multiple people deploying this application to Bluemix do not run into naming collisions. To specify your own route, remove the `random-route` line from the `manifest.yml` file and add a `host` key with the unique value you would like to use for the host name.

### Privacy Notice

This web application includes code to track deployments to [IBM Bluemix](https://www.bluemix.net/) and other Cloud Foundry platforms. The following information is sent to a [Deployment Tracker](https://github.com/cloudant-labs/deployment-tracker) service on each deployment:

* Application Name (`application_name`)
* Space ID (`space_id`)
* Application Version (`application_version`)
* Application URIs (`application_uris`)

This data is collected from the `VCAP_APPLICATION` environment variable in IBM Bluemix and other Cloud Foundry platforms. This data is used by IBM to track metrics around deployments of sample applications to IBM Bluemix to measure the usefulness of our examples, so that we can continuously improve the content we offer to you. Only deployments of sample applications that include code to ping the Deployment Tracker service will be tracked.

#### Disabling Deployment Tracking

Deployment tracking can be disabled by removing the following line from `server.js`:

```
require("cf-deployment-tracker-client").track();
```

Once that line is removed, you may also uninstall the `cf-deployment-tracker-client` npm package.

#### License 

Copyright [2015] [IBM Cloud Data Services]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
