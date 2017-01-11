/*
 * Copyright 2016  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
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