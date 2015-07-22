'use strict';

/**
*	Record transformer of json data used during data copy
*	@Author: David Taieb
*/

var _ = require("lodash");

//Hard coded transform configuration for now. Ultimately will be provided by the user for lightweight ETL
var transformConfiguration = {};

/**
 * RequiredFields directive: Array of field name that must be copied over to the target even if they are empty or non existant in the source record
 */
transformConfiguration["lead"] = {
	"requiredFields" : ["ConvertedAccountId", "ConvertedContactId", "ConvertedDate", "ConvertedOpportunityId"]
}

/**
 * recordTransformer class
 * @param table: table object
 */
function recordTransformer(table){
	
	/**
	*	Process record transformation
	*/
	this.process = function( record ){
		if ( !table.name ){
			return;
		}
		var tableName = table.name.toLowerCase();
		if ( transformConfiguration.hasOwnProperty( tableName )){
			var requiredFields = transformConfiguration[tableName].requiredFields;
			if ( requiredFields ){
				_.forEach( requiredFields, function( fieldName ){
					if ( !record.hasOwnProperty(fieldName) || record[fieldName] == null ){
						record[fieldName] = "";
					}
				})
			}
		}
	}
};

module.exports = recordTransformer;