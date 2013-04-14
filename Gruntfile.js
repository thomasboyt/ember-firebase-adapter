module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  var nameFor = function(root, path) {
    var re = new RegExp("^" + root + "(.*).js$");
    return path.match(re)[1];
  };

  // thanks @wycats!
  this.registerMultiTask('transpile', "Transpile ES6 modules into AMD, CJS or globals", function() {
    var Compiler = require("es6-module-transpiler/lib/compiler");

    var options = this.options({
      format: 'amd'
    });

    this.files.forEach(function(file) {
      var contents = file.src.map(function(path) {
        var name = nameFor(options.root, path);
        
        var compiler = new Compiler(grunt.file.read(path), name, options);

        var format;
        switch (options.format) {
          case 'amd':
            format = compiler.toAMD;
            break;
          case 'globals':
            format = compiler.toGlobals;
            break;
          case 'commonjs':
            format = compiler.toCJS;
            break;
          default:
            grunt.warn("Nonexistant format '" + options.format + "'specified. Valid options: 'amd', 'globals', 'commonjs'.");
            break;
        }

        grunt.log.writeln("Compiling " + path + " to " + options.format);
        return format.call(compiler);
      });

      grunt.file.write(file.dest, contents.join("\n\n"));
    });
  });

  // fyi, jshint never actually passes because of the use of import/export
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'lib/firebase/*.js',
        'test/**/*.js',
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },
    transpile: {
      amd: {
        options: {
          format: 'amd',
          root: 'lib/'
        },
        src: ["lib/firebase_adapter.js", "lib/firebase/*.js"],
        dest: "tmp/out.js"
      }
    },
    copy: {
      dist: {
        src: ["tmp/out_wrapped.js"],
        dest: "dist/firebase_adapter.js"
      }
    },
    uglify: {
      dist: {
        files: {
          "dist/firebase_adapter.min.js": ['dist/firebase_adapter.js']
        }
      }
    },
    requirejs: {
      wrapper: {
        options: {
          name: 'vendor/almond',
          include: ['tmp/out'],
          out: 'tmp/out_wrapped.js',
          optimize: 'none',
          wrap: {
            startFile: "lib/wrapper/start.js",
            endFile: "lib/wrapper/end.js"
          }
        }
      }
    },
    concat: {
      tests: {
        src: ["test/init.js", "test/tests/*.js"],
        dest: "tmp/tests.js"
      }
    },
    connect: {
      server: {
        options: {
          port: 9001,
          base: '.'
        }
      }
    },
    watch: {
      rebuild: {
        files: ["lib/**/*.js"],
        tasks: ["build"]
      },
      test: {
        files: ["test/**/*.js"],
        tasks: ["concat:tests"]
      }
    }

  });

  this.registerTask("build", ["transpile:amd", "requirejs:wrapper"]);
  this.registerTask("dist", ["build", "copy:dist", "uglify:dist"]);
  
  this.registerTask("test", ["build", "concat:tests", "connect:server", "watch"]);

  this.registerTask("default", "build");
};
