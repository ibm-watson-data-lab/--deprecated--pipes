module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        jshint: {
            options : {
                "node" : true,
                ignores : [ "node_modules/**/*.js" ]
            },
            src: ["server/**/*.js", "server.js"],
        }
    });

    grunt.loadNpmTasks("grunt-contrib-jshint");

    grunt.registerTask("default", [ "lint" ]);

    grunt.registerTask("lint", "Check for common code problems.", [ "jshint" ]);
};
