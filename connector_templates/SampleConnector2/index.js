//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2015
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

var connectorExt = require("../connectorExt");

/**
 * Sample connector using a few JSON records
 */
function demoConnector( parentDirPath ){
	//Call constructor from super class
	connectorExt.call(this, "demo", "Demo Connector");
	
	this.getTablePrefix = function(){
		return "demo";
	}
	
	this.fetchRecords = function( table, pushRecordFn, done, pipeRunStep, pipeRunStats, logger, pipe, pipeRunner ){
		pushRecordFn([
		   {'firstname': 'George', 'lastname' : 'Clooney', 'address': 'hollywood blv', 'age': 57 },
		   {'firstname': 'Will', 'lastname' : 'Smith', 'address': 'Rodeo drive', 'age': 45 },
		   {'firstname': 'Brad', 'lastname' : 'Pitt', 'address': 'Beverly hills', 'age': 47 }
        ]);
		return done();
	};
}

//Extend event Emitter
require('util').inherits(demoConnector, connectorExt);

module.exports = new demoConnector();