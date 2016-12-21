# wch-node-connector-sample
Node js wrapper around the Watson Content Hub apis. Coverage will slowly increase. The main focus is currently on authoring APIs. The code is well documented and a good starting point on how to use the connector in your node project. Besides it's always a good idea to have a look at it.

## How to get started
The idea is to publish this as soon as possible on npm. Then simply use 
```
npm i wchnode -S
``` 
> Until then you can always include the github repo with `npm i -S git+ssh://git@github.ibm.com:sterbling/wch-node-sdk.git`.

In order to use the connector in your node application you have to initalize the connector first:
```node
const wchConnector = require('wchnode')({
        tenantid: 'YOUR TENANT ID',
        endpoint: 'publishing',
        credentials: {
          usrname: 'YOUR BLUEID USER',
          pwd: 'YOUR BLUEID PASSWORD'
        },
        maxSockets: 50
      });
```
- `tenantid` - [Required] The Tenantid of your WCH Account you want to connect to. You can find the tenant id when you logged in into the WCH Authoring UI when clicking on the Info Button top left.
- `endpoint` - [Optional] Choose the targeted endpoint. Either calls the authoring endpoint ('authoring') or the delivery endpoint ('publishing'). Default is 'publishing'.
- `credentials` - [Optional] Used to authenticate towards content hub. Is always required when targeting the authoring endpoint. Default is anonymous.
- `maxSockets` - [Optional] Amount of max open connections. Default is 50.

> **NOTE:** You can instantiate the connector multiple times for different usecases.

## Authoring
Current support of authoring APIs is focused on resources, assets, authoring types and search. Future updates should allow to create content items, taxonomigites and rendition profiles.

### Search
TODO

### Resource
TODO

### Assets
TODO

### Content Types
TODO

### Taxonomies/ Categories
TODO

## Delivery
TODO. Idea is to have two options. 
1) Directly retrieve published assets for consumtion in node e.g. JS, JSON or other files.
2) Get a list of delivery URLs targeting the items of a delivery search. Those then can be used in your HTML, JS templates for further actions.

## Next steps
This is a living sample. The goal is to slowly increase the api coverage to 100%. Also the strucuture of this sample will change when the delivery apis are fully available for better separation of concern.