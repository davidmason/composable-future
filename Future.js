function toArray(args) {
    return Array.prototype.slice.call(args);
}

function Future() {
    this.slots = [];
    this.failslots = [];
    this.actions = [];
    this.failactions = [];
}

Future.prototype.ready = function(slot) {    
    if(this.completed)
        slot(this.value);
    else
        this.slots.push(slot);
}

Future.prototype.failed = function(slot) {        
    if(this.hasFailed)
        slot(this.error);
    else
        this.failslots.push(slot);
}

Future.prototype.complete = function(val) {    
    var me = this;
    if(this.completed || this.hasFailed)
        throw "Can't complete an already settled future!";
    
    this.value = val;
    this.completed = true;
    
    for(var i=0, len=this.slots.length; i<len; i++) {
        this.slots[i](val);
    }
    this.slots = null;
    
    setTimeout(function() {
        for(var i=0, len=me.actions.length; i<len; i++) {
            me.actions[i](val);
        }
        me.actions = null;
    });
}

Future.prototype.fail = function(err) {
    var me = this;    
    if(this.completed || this.hasFailed)
        throw "Can't complete an already settled future!"
    
    this.hasFailed = true;
    this.error = err;
    
    for(var i=0, len=this.failslots.length; i<len; i++) {
        this.failslots[i](err);
    }
    this.failslots = null;
    
    
    setTimeout(function() {
        for(var i=0, len=me.failactions.length; i<len; i++) {
            me.failactions[i](err);
        }
        me.failactions = null;
    });
}

Future.prototype.fmap = function(fn) {
    var fut = new Future();
    this.ready(function(val) {
        try {
            fut.complete( fn(val) );
        } catch(err) {
            fut.fail(err);
        }
        
    });
    this.failed(function(err) {
        fut.fail( err );
    });
    return fut;
}

Future.prototype.fmapError = function(fn) {
    var fut = new Future();
    this.ready(function(val) {
        fut.complete( val );
    });
    this.failed(function(err) {
        try {
            fut.complete( fn(err) );
        } catch(err1) {
            fut.fail( err1 );
        }
        
    });
    return fut;
}

Future.prototype.flatten = function() {
    var fut = new Future();
    this.failed(function(err) {
        fut.fail(err);
    });
    this.ready(function(fut2) {
        fut2.failed( function(err){
            fut.fail(err);
        } );
    }); 
    this.ready(function(fut2) {
        fut2.ready( function(val){
            fut.complete(val);
        } );
    });      
    return fut;
}

Future.prototype.flatMap = function( fn ) {
    return this.fmap(fn).flatten();
}

Future.prototype.flatMapError = function( fn ) {
    return this.fmapError(fn).flatten();
}

Future.lift1 = function(fn) {
    return function(fut) {
        return fut.fmap(f);
    }
}

Future.lift2 = function(fn) {
    return function(fut1, fut2) {
        return fut1.flatMap(function(value1) {
            return fut2.flatMap(function(value2) {
                return Future.unit( fn(value1, value2) );
            });
        });
    }
}

Future.lift3 = function(fn) {
    return function(fut1, fut2, fut3) {
        return fut1.flatMap(function(value1) {
            return fut2.flatMap(function(value2) {
                return fut2.flatMap(function(value3) {
                    return Future.unit( fn(value1, value2, value3) );
                });                
            });
        });
    }
}

Future.lift = function(fn) {
    return function() {
        var args = toArray(arguments),
            ctx = this;
        
        return bindArg(0, []);
        
        function bindArg(index, actArgs) {                
            return args[index].flatMap(function(val) {
                actArgs = actArgs.concat(val);
                return (index <  args.length - 1) ?
                            bindArg(index+1, actArgs) :
                            Future.unit( fn.apply(ctx, actArgs) );
            });           
        }
    }
}

Future.prototype.do = function(action) {
    var fut = new Future();
    if(this.completed) {
        action(this.value);
        fut.complete(this.value);
    } else {
        this.actions.push(action);
    }
    return fut;
}

Future.prototype.doError = function(action) {
    var fut = new Future();
    if(this.hasFailed) {
        action(this.error);
        fut.fail(this.error);
    } else {
        this.failactions.push(action);
    }
    return fut;
}

Future.never = function() {
    return new Future();   
}

Future.unit = function(val) {
    var fut = new Future();
    fut.complete(val);
    return fut;
}

Future.delay = function(v, ms) {
    var f = new Future();
    setTimeout(function(){
        f.complete(v);
    }, ms);
    return f;
}

function logF(f) {
    f.do(function(v) {
        console.log('Future completed with', v);
    });
}

function logErrF(f) {
    f.doError(function(err) {
        console.log('Future failed with', err);
    });
}


var fs = require('fs');

function readFileF(file, options) {
    var f = new Future();
    fs.readFile(file, options, function (err, data) {
        if (err) f.fail(err);
        else
            f.complete(data);
    });
    return f;
}

function readDirF(path) {
    var f = new Future();
    fs.readdir(path, function (err, files) {
        if (err) f.fail(err);
        else 
            f.complete(files);
    });
    return f;
}

var concat = Future.lift(function() {
    return toArray(arguments).join(' ');
});

result = readDirF('testdir').flatMap(function(files) {
    var filesF = files.map( function(file) {        
        return readFileF('testdir/' + file, {encoding: 'utf8'});
    });
    return concat.apply(null, filesF);
});

logF( result );
