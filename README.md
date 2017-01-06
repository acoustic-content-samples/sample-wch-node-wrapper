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

> **NOTE:** You can instantiate the connector multiple times e.g. to access different tenants at the same time.

## Authoring
Current support of authoring APIs is focused on resources, assets, authoring types and search. Future updates should allow to create content items, taxonomies and rendition profiles. Please note that you should only use the authoring APIs for authoring and never for content retrieval in production use cases with high amounts of traffic.

### Authentication

> `doLogin(credentials)`

This method is normally hidden when using this sample. However I want to talk about the two ways (GET or POST) of authentication towards WCH. If you have a look at the code you will see that in this sample the GET path is implemented. Since both methods do exactly the same thing it's just a matter of preference which way you want to use. What are the details you should consider when implementing your own authentication?

**GET**

The GET path is based around basic authentication. Make sure to encode your username and password in the authorization header.

```http
GET https://my.digitalexperience.ibm.com/api/login/v1/basicauth
Headers:
  Authorization: Basic Base64[USERNAME:PASSWORD]
```

**POST**

The POST path requires no headers but instead you send your credentials in the body which has to be application/x-www-form-urlencoded.

```http
POST https://my.digitalexperience.ibm.com/api/login/v1/basicauth
Headers:
  Content-Type: application/x-www-form-urlencoded
Body:
   j_username=<USERNAME>&j_password=<PASSWORD>
```

---

### Search

> `doQuery(queryParams)`

Performs a search against all content on the authoring environment. The query is based [on Solr][SolrQry]. Hence you can have a look at their documentation for further information on how to create a valid query. Make sure to escape your query properly. Have a look at the simple helper method `escapeSolrChars` on how to do so.

[SolrQry]: https://cwiki.apache.org/confluence/display/solr/Query+Syntax+and+Parsing

```javascript
WCHConnector.doQuery({
        query : '*:*',
        fields: 'creator, lastModified, classification',
        facetquery : ['classification:asset', 'lastModified:[2016-12-20T09:15:25.882Z TO NOW]'],
        amount : 30,
        sort : 'creator asc, lastModified desc',
        start : 5
      });
```

- `queryParams` - [Required] The search query object passed into the method.
- `queryParams.query` - [Optional] The main query. Must be a valid Solr query. Defaults to query for all content.  
- `queryParams.fields` - [Optional] Comma separated list of fiels to get returned in the search result. Default are all fields.
- `queryParams.facetquery` - [Optional] Subquery performed on the results of the main query. The input can also be an array containing multiple facet queries.
- `queryParams.amount` - [Optional] The amount of documents that will be returned in the search result. Defaults to 10 documents matching the query.
- `queryParams.sort` - [Optional] Define a valid Solr sort criteria based on a valid index. Can also contain multiple indexes. Sortable either asc (ascending) or desc (descending)
- `queryParams.start` - [Optional] The starting point after sorting from where to return the number of elements defined in `amount`. Default starting point is index 0. 

---

### Resource

Resources are not directly visible in the authoring UI since resources are mainly a technical concept. Every asset references a resource by it's unique id. Hence you can think of a resource as the actual binary that is stored in WCH and an asset are specific metadata describing and referencing a resource. **NOTE:** If you study the public APIs closely you will see that there is no DELETE endpoint for resources. This is because resources will get autocleaned periodically by WCH if there are no more assets which are referencing the resource.

> `createResource(resourceDef)`

Uploads a resource to WCH. Make sure to link the resource to an asset afterwards. Be aware that the binaries of a resource can't get updated here. It's only possible to update metadata of resources. For use cases requiring an update have a look at the assets section. 

```javascript
WCHConnector.createResource({
        filePath : 'Absolute/Path/To/YourFileToUpload.jpeg',
        fileName : 'nameinwch.whateveryoulike',
        randomId : true
      });
```

- `resourceDef` - [Required] The definition of an resource to upload.
- `resourceDef.filePath` - [Required] An absolute path to a file that should be uploaded to WCH as a resource. 
- `resourceDef.fileName` - [Optional] Set a WCH specific name for this resource. This name will be shown in the authoring UI for this resource. Default is the filename.
- `resourceDef.randomId` - [Optional] If random ID is true a generic UUID is given as an ID to the resource, otherwise the filename will be uses as the unique ID. (Hence be careful with naming colissions) Default is true.

---

### Assets

TODO

---

### Content Types

TODO

---

### Taxonomies/ Categories

> `getCategoryTree(categoryId, config)`

Query method to get the tree of sub categories based on a starting category. A good usecase would be to get a whole taxonmy based on the starting category id.
- `categoryId` - [Required] The ID of the category from where to retrieve the children
- `config.recurse` - [Optional] If true it will also include children of children, if false only direct childs are returned. Defaults to true.
- `config.limit` - [Optional] How many children are maximal returned. Default is *100*.
- `config.offset` - [Optional] Where to start returning the children. Useful to return subtrees. Defaults to 0.

> `createCategory(categoryDef)`

The taxonomy API is based around the simple category API endpoint. This allows you to create standalone categories based on the following definition:

```javascript
WCHConnector.createCategory({
  name: "NAMEOFTHECATEGORY",
  parent: "PARENTCATEGORY"
});
```
- `name` - [Required] The name of the category. Has to be unique in a taxonomy. (Hence can be used in multiple taxonomies)
- `parent` - [Optional] - The parent category. If omitted this will create a new taxonomy with the name provided.

> `createTaxonomies(taxonomyDefinition)`

Creating a complete taxonomy is based on a simple json definition file. The definition consists of an array of taxonomy level definitions.

```json
[ 
  {
    "name" : "mycooltesttax",
    "childs": ["mycoolcat1", "mycoolcat2", "mycoolcat3"]
  },
  {
    "parent": "mycoolcat1",
    "childs": ["mycoolsubcat1"]
  },
  {
    "parent": "mycoolcat3",
    "childs": ["mycoolsubcat1"]
  },
  {
    "parent": "mycoolsubcat1",
    "childs": ["mycoolsubsubcat1", "mycoolsubsubcat2"]
  }
]
```
- `name` - [Required] If you want to create the first level of a taxonomy including it's name.
- `parent` - [Required] For all taxonomy levels below the root. Specifies the name of the parent category. 
- `childs` - [Required] All categories that should be defined on this level.
> **NOTE:** You could create multiple taxonomies in one definition. As soon as a new taxonomy is started make sure that all following category levels are targeted at the new taxonomy.

> `deleteCategory(categoryId)`

Deletes a category based on it's it. Will also delete all subcategories. Hence if you want to delete a taxonomy delete the root category.

> `deleteTaxonomies(query, amount)`

Convienience method which can be used to delete one or multiple taxonomies based on a search query. For details on how to define a query have a look at the search section.

---

## Delivery
TODO. Idea is to have two options. 
1) Directly retrieve published assets for consumtion in node e.g. JS, JSON or other files.
2) Get a list of delivery URLs targeting the items of a delivery search. Those then can be used in your HTML, JS templates for further actions.

## Next steps
This is a living sample. The goal is to slowly increase the api coverage to 100%. Also the strucuture of this sample will change when the delivery apis are fully available for better separation of concern.