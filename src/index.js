(function () {
  'use strict';

  var through2 = require('through2');
  var Vinyl = require('vinyl');
  var fs = require('fs');
  var path = require('path');
  var jsesc = require('jsesc');
  var Handlebars = require('handlebars');
  var vfs = require('vinyl-fs');
  var jsonSchema = require('./json-schema');
  var path = require('path')

  /**
   * Inline file contents by replacing @<path>postfix with the contents
   * of the file found at <path>postfix relative to original file path.
   */
  function inline(file, postfix) {
    if (file.path.indexOf('.json') > 0) {
      var originalFilePath = getParentDir(file);
      var matchingPattern = new RegExp('@(.*)' + postfix);
      var contents = String(file.contents);
      var match = matchingPattern.exec(contents);

      if (match) {
        var contentsFilePath = path.join(originalFilePath, match[1] + postfix);
        if (fs.existsSync(contentsFilePath)) {
          file.contents = Buffer.from(contents.replace(
            matchingPattern,
            jsesc(fs.readFileSync(contentsFilePath, 'utf8'), {'quotes': 'double'})));
        }
      }
    }
    return file;
  }

  function getDirectiveTemplate(context) {
    return Handlebars.compile(String(fs.readFileSync(__dirname + '/widgetDirectiveTemplate.hbs.js')))(context);
  }

  function buildDirective(file) {
    var context = JSON.parse(file.contents);
    context.escapedTemplate = jsesc(context.template);
    return new Vinyl({
      cwd: file.cwd,
      base: file.base + path.sep,
      path: file.path.replace('.json', '.js'),
      contents: Buffer.from(getDirectiveTemplate(context))
    });
  }

  function pushTo(stream) {
    return through2.obj(function (file, enc, callback) {
      stream.push(file);
      callback();
    });
  }

  function getParentDir(file) {
    return file.path.slice(0, file.path.lastIndexOf(path.sep) - file.path.length);
  }

  function buildWidget() {

    return through2.obj(function (file, enc, callback) {
      file.base= file.base + path.sep;
      var options = {base: file.base + path.sep, allowEmpty: true };
      var parentDir = getParentDir(file);
      inline(file, '.tpl.html');
      inline(file, '.ctrl.js');
      this.push(file);
      this.push(buildDirective(file));

        vfs.src([path.join(parentDir, '/assets/**/*.*'), path.join(parentDir, '/help.html')], options)
          .pipe(pushTo(this))
          .on('finish', function () {
            callback();
          });

    });
  }

  module.exports = {
    buildWidget,
    jsonSchema
  }
})();
