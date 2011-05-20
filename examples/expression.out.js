var sum, a, b, c, d, _r1, _r2, _r5, _r6, _r7;

var _done = 0, triggers = [ function(_index) {
    if (3 === (_done & 3)) {
        triggers.splice(_index, 1);
        foo(_r1 + _r2, function(_err, _r3) {
            if (_err) return cb(_err);
            sum = _r3;
        });
    }
}, function(_index) {
    if (28 === (_done & 28)) {
        triggers.splice(_index, 1);
        a = _r5;
        b = _r6;
        c = _r7;
    }
} ];

function trigger() {
    for (var i = triggers.length - 1; i >= 0; i--) {
        triggers[i](i);
    }
}

foo(function(_err, __r1) {
    if (_err) return cb(_err);
    _r1 = __r1;
    _done |= 1;
    process.nextTick(trigger);
});

foo(function(_err, __r2) {
    if (_err) return cb(_err);
    _r2 = __r2;
    _done |= 2;
    process.nextTick(trigger);
});

foo(function(_err, _r4) {
    if (_err) return cb(_err);
});

var m;

var x = 0, y = 1, z;

foo(function(_err, __r5) {
    if (_err) return cb(_err);
    _r5 = __r5;
    _done |= 4;
    process.nextTick(trigger);
});

foo(function(_err, __r6) {
    if (_err) return cb(_err);
    _r6 = __r6;
    _done |= 8;
    process.nextTick(trigger);
});

foo(function(_err, __r7) {
    if (_err) return cb(_err);
    _r7 = __r7;
    _done |= 16;
    process.nextTick(trigger);
});