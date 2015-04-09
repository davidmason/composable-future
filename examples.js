var fs = require('fs')
  , Future = require('./index.js')
  , timeout = 10000
  ;

function toArray(args) {
    return Array.prototype.slice.call(args);
}


function logF(f) {
    f.do(function(v) {
        console.log('Future completed with', v);
        // clearTimeout(timer);
    });
}

function logErrF(f) {
    f.doError(function(err) {
        console.log('Future failed with', err);
        console.log(err.stack);
        // clearTimeout(timer);
    });
}

// readFileF: (String, Object) -> Future<String>
function readFileF(file, options) {
    var f = new Future();
    fs.readFile(file, options, function (err, data) {
        if (err) f.fail(err);
        else
            f.complete(data);
    });
    return f;
}

// readDirF: String -> Future<Array<String>>
function readDirF(path) {
    var f = new Future();
    fs.readdir(path, function (err, files) {
        if (err) f.fail(err);
        else f.complete(files);
    });
    return f;
}

// concat: (Future<String>, ...) -> Future<String>
var concat = Future.lift(function() {
    return toArray(arguments).join(' ');
});

// result: Future<String>
result = readDirF('example-files').flatMap(function(files) {
    // filesF: Array<Future<String>>
    var filesF = files.map( function(file) {
        return readFileF('example-files/' + file, {encoding: 'utf8'});
    });

    return concat.apply(null, filesF);
});

logF(result);
logErrF(result);
