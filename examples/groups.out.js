var _r1, a, _r2, b, _r3, c, d, e, f;

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

foo(function(_err, __r1) {
    if (_err) return cb(_err);
    _r1 = __r1;
    _done |= 1;
    process.nextTick(trigger);
    a = _r1;
});

foo(function(_err, __r2) {
    if (_err) return cb(_err);
    _r2 = __r2;
    _done |= 2;
    process.nextTick(trigger);
    b = _r2;
});

foo(function(_err, __r3) {
    if (_err) return cb(_err);
    _r3 = __r3;
    _done |= 4;
    process.nextTick(trigger);
    c = _r3;
});
