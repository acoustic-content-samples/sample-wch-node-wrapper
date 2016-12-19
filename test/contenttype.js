module.exports = {
    "id": "test",
    "name": "TestUploadedType",
    "classification": "content-type",
    "description": "",
    "status": "ready",
    "tags": [
      "proto_wch_spa_simple",
      "new"
    ],
    "templateMapping": "",
    "schema": {
      "$schema": "http://json-schema.org/draft-04/schema#",
      "additionalProperties": false,
      "properties": {
        "searchquery": {
          "title": "searchquery",
          "type": "object",
          "properties": {
            "elementType": {
              "enum": [
                "text"
              ],
              "default": "text"
            },
            "value": {
              "title": "Text",
              "type": "string"
            }
          },
          "required": [
            "elementType",
            
            "value"
          ],
          "additionalProperties": false
        }
      },
      "type": "object",
      "required": [
        "searchquery"
      ]
    },
    "form": [
      {
        "key": "searchquery",
        "type": "dx-fieldset",
        "items": [
          {
            "key": "searchquery.value",
            "type": "dx-text"
          }
        ]
      }
    ]
  }