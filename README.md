# sample-wch-node-wrapper
Node js wrapper around the Watson Content Hub APIs. Coverage will slowly increase. At the moment the authoring APIs are the main focus of this sample. The sample code is well documented and provides you with further details on how to use the connector in your own node project. (Besides it's always a good idea to have a look at the code :) ).

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
        endpoint: 'delivery',
        credentials: {
          usrname: 'YOUR BLUEID USER',
          pwd: 'YOUR BLUEID PASSWORD'
        },
        maxSockets: 50
      });
```
- `tenantid` - [Required] The tenantid of your WCH account. You find the tenantid in the authoring UI after login. Simply click on the info button you'll find on the top left.
- `endpoint` - [Optional] Choose the api endpoint. The connector either interacts with content in the authoring environment ('authoring') or with delivered content ready for production use cases ('delivery'). Default is 'delivery'.
- `credentials` - [Optional] Used to authenticate towards content hub. You always have to pass in your credential when choosing the authoring endpoint. Per Default you get anonymous access to the delivery endpoint.
- `maxSockets` - [Optional] Amount of max open connections per connector instance. Default is 50.

> **NOTE:** You can instantiate the connector multiple times e.g. to access different tenants at the same time. (Or the same tenant against different endpoints or with different user roles)

For more details on how to get started: Have a look at the samples folder where you find a [very simple sample][getstartedsample] on how to initalize and call the connector in your node application. If called correctly (`node ./sample/starterSample.js`) you should see something [like this][getstartedsampleoutput].

[getstartedsample]: https://github.ibm.com/sterbling/sample-wch-node-wrapper/blob/master/samples/starterSample.js
[getstartedsampleoutput]: https://github.ibm.com/sterbling/sample-wch-node-wrapper/blob/master/samples/startSampleOutput.PNG

## Authoring
Current support of authoring APIs is focused on resources, assets, authoring types and search. This sample is a work in progress. Future updates should allow you to create content items and rendition profiles. Please note that you should only use the authoring APIs for authoring purposes only. They are not optimized for production use cases that might involve high amounts of traffic. 

### Authentication

> `doLogin(credentials)`

When providing the connector with your credentials this method is called automatically. More generally speaking I want to talk about the two ways (GET or POST) of authentication towards WCH. In this sample connector the GET path is implemented. Since both methods do exactly the same thing it's just a matter of preference.

**GET**

The GET path is based around basic authentication. Make sure to encode your username and password in the authorization header.

```http
GET https://my.digitalexperience.ibm.com/api/login/v1/basicauth
Headers:
  Authorization: Basic Base64[USERNAME:PASSWORD]
```

**POST**

The POST path requires no headers but instead you send your credentials in the body which has to be application/x-www-form-urlencoded. This approach could be a nice fit for form based logins.

```http
POST https://my.digitalexperience.ibm.com/api/login/v1/basicauth
Headers:
  Content-Type: application/x-www-form-urlencoded
Body:
   j_username=USERNAME&j_password=PASSWORD
```

---

### Search

> `doSearch(queryParams)`

Performs a search against all content on the authoring environment. The query is based [on Solr][SolrQry]. Hence you should have a look at their documentation for further information on how to create a valid query. Make sure to escape your query properly. See the simple helper method `escapeSolrChars` on how to do so.

[SolrQry]: https://cwiki.apache.org/confluence/display/solr/Query+Syntax+and+Parsing

```javascript
WCHConnector.doSearch({
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
- `queryParams.fields` - [Optional] Comma separated list of fiels to get returned in the search result. Default is set to all available fields.
- `queryParams.amount` - [Optional] The amount of documents that will be returned in the search result. Defaults to 10 documents matching the query.
- `queryParams.sort` - [Optional] Define a valid Solr sort criteria based on a valid index. Can also contain multiple indexes. Sortable either asc (ascending) or desc (descending)
- `queryParams.start` - [Optional] The starting point after sorting from where to return the number of elements defined in `amount`. Default starting point is index 0. 
- `queryParams.facetquery` - [Optional] Subquery performed on the results of the main query. The input can also be an array containing multiple facet queries.
- `queryParams.isManaged` - [Optional] If true the result set only contains on managed elements. If set to false on unmanaged elements are returned. (Only Managed elements are visible in the authoring UI) Default are all elements. No difference between managed an unmanaged.

**Extended Search Options**

For some search scenarios you might find the standard query parser quite cumbersome to use. Especially that the standard query parses enforces a more rigid syntax might be troubeling for searches performed by customers. Therefore there are two other main parsers available with Solr. Those two can also be used for building search queries against WCH. For details about all available parsers have a [look at the Solr documentation][Dismax]. The current state of the sample supports the default 'lucene' parser, the 'dismax' (maximum disjunction) parser and the 'edismax' (extended maximum disjunction) parser. A complete parameter support will come over time.

Another feature supported for extended use cases is faceting. You can use faceting for example if you want to implement [typeahead support][typeaheadsample] against WCH content or if you want to give the user 'drill-down' options to refine the search. You can also use faceting for range exploration as [shown in this example][youractivitysample]. For details reference [the official documentation][Faceting].

[Dismax]: https://cwiki.apache.org/confluence/display/solr/The+DisMax+Query+Parser
[Faceting]: https://cwiki.apache.org/confluence/display/solr/Faceting
[typeaheadsample]: https://github.ibm.com/sterbling/sample-wch-node-wrapper/blob/master/samples/typeaheadSample.js
[youractivitysample]: https://github.ibm.com/sterbling/sample-wch-node-wrapper/blob/master/samples/yourActivitySample.js

```javascript
WCHConnector.doSearch({
        query : '*test*',
        amount : 0,
        dismax: {
          extended: true,
          queryFields: ['name', 'assetType', 'tags', 'status', 'categoryLeaves keywords renditionCount'],
        },
        facet: {
          fields: ['name', 'assetType', 'tags', 'status', 'categoryLeaves', 'keywords', 'creator'],
          range: {
            fields: ['created', 'lastModified'],
            start: 'NOW/DAY-30DAYS',
            end: 'NOW',
            gap: '+1DAY'
          },
          mincount: 1,
          limit: 10,
          contains : {
            text: 'Test',
            ignoreCase: true
          }
        },
        override: {
          'created.facet.mincount': 0, 
          'lastModified.facet.mincount': 0
        }
      });
```
- `dismax` - [Optional]
- `dismax.extended` - [Optional]
- `dismax.queryFields` - [Required]
- `facet` - [Optional] 
- `facet.fields` - [Required]
- `facet.range` - [Optional]
- `facet.range.fields` - [Optional]
- `facet.range.start` - [Optional]
- `facet.range.end` - [Optional]
- `facet.range.gap` - [Optional]
- `facet.mincount` - [Optional]
- `facet.limit` - [Optional]
- `facet.contains` - [Optional]
- `facet.contains.text` - [Optional]
- `facet.contains.ignoreCase` - [Optional]

---

### Resource

Resources are not directly visible in the authoring UI. But if you want to upload new assets you should get familliar with the concept. Every asset references a resource by its unique id. Hence you can think of a resource as the actual binary representation which is stored in WCH. And an asset is referencing a resource by its id and adds further metadata to the resource (e.g. name, path, description). **NOTE:** If you study the public APIs closely you will see that there is no DELETE endpoint for resources. This is because resources will get autocleaned periodically by WCH if there are no assets left in WCH referencing the resource.

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

Through the command line tool you also have the option to upload 'Web Assets'.  

> `deleteAsset(assetId)`

Deletes a single asset from WCH. Note: The linked resource will only be deleted when there are no other assets linked to the resource. 

- `resourceDef.randomId` - [Required] The ID of the asset to be deleted

> `deleteAssets(query, amount)`

Deletes the specified amount of assets matching the query.

```javascript
  let deleteQry = 'name:*Calendar* AND document:*Test*';
  WCHConnector.deleteAssets(deleteQry, 100);
```

- `query` - [Required] The assetquery used to select the assets to get deleted. Can also be an array of multiple facetqueries.
- `amount` - [Optional] Amount of assets to get deleted. Defaults to 100.

> `createAsset(assetDef)`

Creates a new asset definition. If you set the path attribute the asset will be creates as an webasset. In this case it is not visible in the authoring UI.

```javascript
  let assetDef = {
    id: 'IdOfTheAsset', // If empty you get a random ID
    tags: {"values":['demo', 'upload'],"declined":[],"analysis":"none"},
    description: 'Your description of the asset to upliad',
    name: 'NameOfTheAsset',
    resource: 'ID to an existing resource'
  };
  WCHConnector.createAsset(assetDef);
```

- `assetDef` - [Required] Valid WCH definition of an asset.
- `assetDef.id` - [Optional] The id of the new assset
- `assetDef.tags` - [Required] Tag structure of assets. Consists of active, declined and watson tags.
- `assetDef.tags.values` - [Required] String array with active tags for this asset. 
- `assetDef.tags.declined` - [Required] String array with declined tags for this asset.
- `assetDef.tags.analysis` - [Required] String indicating the status of watson auto tagging. Should be set to "none".
- `assetDef.description` - [Optional] Description of the asset to be uploaded.
- `assetDef.name` - [Required] The visible name of this asset for authoring UI.
- `assetDef.resource` - [Required] The resource ID to the binary file this asset references.
- `assetDef.path` - [Optional] When this attribute is set the asset is handled as a web asset and not visible in the authoring UI.

> `updateAsset(assetDef)`

Updates an existing asset definition.

```javascript
  let assetDef = {
    id: 'IdOfTheAsset', // If empty you get a random ID
    tags: {"values":['demo', 'upload'],"declined":[],"analysis":"none"},
    description: 'Your description of the asset to upliad',
    name: 'NameOfTheAsset',
    resource: 'ID to an existing resource'
  };
  WCHConnector.updateAsset(assetDef);
```

- `assetDef` - [Required] Valid WCH definition of an asset.
- `assetDef.id` - [Optional] The id of the new assset
- `assetDef.tags` - [Required] Tag structure of assets. Consists of active, declined and watson tags.
- `assetDef.tags.values` - [Required] String array with active tags for this asset. 
- `assetDef.tags.declined` - [Required] String array with declined tags for this asset.
- `assetDef.tags.analysis` - [Required] String indicating the status of watson auto tagging. Should be set to "none".
- `assetDef.description` - [Optional] Description of the asset to be uploaded.
- `assetDef.name` - [Required] The visible name of this asset for authoring UI.
- `assetDef.path` - [Optional] When this attribute is set the asset is handled as a web asset and not visible in the authoring UI.

> `uploadAsset(options)`

Convenience method which uploads and creates a resource and afterwards an asset definition.

```javascript
  let asset = {
        resourceDef :  {
          filePath : 'Absoulte/Path/To/YourResourceToUpload.whatever',
          fileName : 'thisname.jpg',
          randomId : false
        },
        assetDef: {
          id: 'IdOfTheAsset', // If empty you get a random ID
          tags: {"values":['demo', 'upload'],"declined":[],"analysis":"none"},
          description: 'Your description of the asset to upload',
          name: 'NameOfTheAsset',
          categoryIds:["IDOFACATEGORY"]
        } 
  }
  WCHConnector.uploadAsset(asset);
```

- `options` - [Required] Valid WCH definition of an asset.
- `options.filePath` - [Required] An absolute path to a file that should be uploaded to WCH as a resource. 
- `options.fileName` - [Optional] Set a WCH specific name for this resource. This name will be shown in the authoring UI for this resource. Default is the filename.
- `options.randomId` - [Optional] If random ID is true a generic UUID is given as an ID to the resource, otherwise the filename will be uses as the unique ID. (Hence be careful with naming colissions) Default is true.
- `options.assetDef.id` - [Optional] The id of the new assset. If omitted you get a random ID for your asset.
- `options.assetDef.tags` - [Required] Tag structure of assets. Consists of active, declined and watson tags.
- `options.assetDef.tags.values` - [Required] String array with active tags for this asset. 
- `options.assetDef.tags.declined` - [Required] String array with declined tags for this asset.
- `options.assetDef.tags.analysis` - [Required] String indicating the status of watson auto tagging. Should be set to "none".
- `options.assetDef.description` - [Optional] Description of the asset to be uploaded.
- `options.assetDef.name` - [Required] The visible name of this asset for authoring UI.
- `options.assetDef.resource` - [Required] The resource ID to the binary file this asset references.
- `options.assetDef.path` - [Optional] When this attribute is set the asset is handled as a web asset and not visible in the authoring UI.

---

### Content Types

Creating content types through the API is rather complex. So at the moment the connector samples about this area are very simple. All samples require a valid type definition which was created through the authoring UI and altered afterwards manually.

> `getContentTypeDefinitions(options)`

Simple wrapper around search API reducing the search set to only content types. Hence usage is the same as `doSearch`. The only difference is that the query param is preset and fixed.

> `createContentType(typeDefinition)`

Creates a new content type based on a valid type definition. Type definitions get complex pretty fast. Therefore the recommendation at the moment is to use the authoring UI for such use cases.

> `updateContentType(typeDefinition)`

Updates an existing content type. You only are able to update from the most current version. So if somebody changes the content type before you - you have to make your changes based on the new current version.

---

### Taxonomies/ Categories

> `getCategoryTree(categoryId, config)`

Query method to get the tree of sub categories based on a starting category. A good usecase would be to get a whole taxonomy based on the starting category id.
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

Taxonomy Definition:
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

Connector Call:
```javascript
let taxonomyDef = ... // Load the taxonomy definition
WCHConnector.createTaxonomies(taxonomyDef);
```

- `name` - [Required] If you want to create the first level of a taxonomy including its name.
- `parent` - [Required] For all taxonomy levels below the root. Specifies the name of the parent category. 
- `childs` - [Required] All categories that should be defined on this level.
> **NOTE:** You could create multiple taxonomies in one definition. As soon as a new taxonomy is started make sure that all following category levels are targeted at the new taxonomy.

> `deleteCategory(categoryId)`

Deletes a category based on its it. Will also delete all subcategories. Hence if you want to delete a taxonomy delete the root category.

> `deleteTaxonomies(query, amount)`

Convienience method which can be used to delete one or multiple taxonomies based on a search query. For details on how to define a query have a look at the search section.

---

## Delivery
Currently only assets can be delivered. 

> `getResourceDeliveryUrls(options)`

Convienience method which creates valid delivery urls to resources based on a search query. Per default no distinction is made between assets and web-assets. If you want to restrict the search to only one of those use the `isManaged` search parameter. Have a look at [this sample][resourcedeliverysample] on how the different urltypes look like.

[resourcedeliverysample]: https://github.ibm.com/sterbling/sample-wch-node-wrapper/blob/master/samples/resourceDeliveryUrlSample.js

```javascript
WCHConnector.getResourceDeliveryUrls({
  urlType: 'akami',
  queryParams: {
    facetquery: 'name:*TypeTest*',
    amount: 1,
    isManaged: false
  }
});
```
- `options` - [Optional] Options on how to generate the delivery Urls.
- `options.urlType` - [Optional] Defines the URL type. Valid options are `id`, `path` and `akami`. Default type is id.
- `options.queryParams` - [Optional] Refines the query to match for a specific set of assets. All params as in `doSearch` are allowed expect for query and fields. 

---

## Next steps
This is a living sample. The goal is to slowly increase the api coverage to 100%. Also the strucuture of this sample will change when the delivery apis are fully available for better separation of concern. Furthermore creating good test cases is another todo.

---

### Resources

API Explorer reference documentation: https://developer.ibm.com/api/view/id-618

Watson Content Hub developer center: https://developer.ibm.com/wch/

Watson Content Hub forum: https://developer.ibm.com/answers/smart-spaces/watson-content-hub.html