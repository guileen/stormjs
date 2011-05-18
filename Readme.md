stormjs, intelligence compiler
========

stormjs is a compiler inspired from streamlinejs.

Serial
----

    var a = foo(_);
    var b = foo(a, _);

will compile to

    foo(function(err, _r1){
        if(err) return cb(err);
        var a = _r1;
        foo(a, function(err, _r2){
          if(err) return cb(err);
          var b = _r2;
        });
    });

Parallel
----

    var a = foo(_);
    var b = foo(_);

will compile to

    foo(function(err, _r1){
      if(err) return cb(err);
      var a = r1;
    });

    foo(function(err, _r2){
      if(err) return cb(err);
      var b = r2;
    });

Parallel then callback
----

    var a = foo(_);
    var b = foo(_);
    var d = foo(a, b, _);

will compile to

    var a, b, c;

    var count = 2;

    function update() {
        if (--count === 0) {
            foo(a, b, function(_err, _r3) {
                if (_err) return cb(_err);
                c = _r3;
            });
        }
    }

    foo(function(_err, _r1) {
        if (_err) return cb(_err);
        a = _r1;
        update();
    });

    foo(function(_err, _r2) {
        if (_err) return cb(_err);
        b = _r2;
        update();
    });

Parallel then grouped callback
----

    var a = foo(_);
    var b = foo(_);
    var c = foo(_);
    var d = foo(a, b, _);
    var e = foo(a, c, _);
    var f = foo(b, c, _);

will compile to

    var a, b, c, d, e, f;

    var _done = 0, triggers = [ function() {
        if (_done & 3) {
            triggers.splice(triggers.indexOf(this), 1);
            foo(a, b, function(_err, _r4) {
                if (_err) return cb(_err);
                d = _r4;
            });
        }
    }, function() {
        if (_done & 5) {
            triggers.splice(triggers.indexOf(this), 1);
            foo(a, c, function(_err, _r5) {
                if (_err) return cb(_err);
                e = _r5;
            });
        }
    }, function() {
        if (_done & 6) {
            triggers.splice(triggers.indexOf(this), 1);
            foo(b, c, function(_err, _r6) {
                if (_err) return cb(_err);
                f = _r6;
            });
        }
    } ];

    function trigger() {
        for (var i = trigger.length - 1; i >= 0; i--) {
            triggers[i]();
        }
    }

    foo(function(_err, _r1) {
        if (_err) return cb(_err);
        _done |= 1;
        process.nextTick(trigger);
        a = _r1;
    });

    foo(function(_err, _r2) {
        if (_err) return cb(_err);
        _done |= 2;
        process.nextTick(trigger);
        b = _r2;
    });

    foo(function(_err, _r3) {
        if (_err) return cb(_err);
        _done |= 4;
        process.nextTick(trigger);
        c = _r3;
    });

Install
====

    npm install storm

Usage
====

    storm filename
