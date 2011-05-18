var a, b, c, d, e, f;

var _done = 0, triggers = [ function(_index) {
    if (3 === (_done & 3)) {
        triggers.splice(_index, 1);
        foo(a, b, function(_err, _r4) {
            if (_err) return cb(_err);
            d = _r4;
            console.log("d=" + d);
        });
    }
}, function(_index) {
    if (5 === (_done & 5)) {
        triggers.splice(_index, 1);
        foo(a, c, function(_err, _r5) {
            if (_err) return cb(_err);
            e = _r5;
            console.log("e=" + e);
        });
    }
}, function(_index) {
    if (6 === (_done & 6)) {
        triggers.splice(_index, 1);
        foo(b, c, function(_err, _r6) {
            if (_err) return cb(_err);
            f = _r6;
            console.log("f=" + f);
        });
    }
} ];

function trigger() {
    for (var i = triggers.length - 1; i >= 0; i--) {
        triggers[i](i);
    }
}

foo(function(_err, _r1) {
    if (_err) return cb(_err);
    _done |= 1;
    process.nextTick(trigger);
    a = _r1;
    console.log("a=" + a);
});

foo(function(_err, _r2) {
    if (_err) return cb(_err);
    _done |= 2;
    process.nextTick(trigger);
    b = _r2;
    console.log("b=" + b);
});

foo(function(_err, _r3) {
    if (_err) return cb(_err);
    _done |= 4;
    process.nextTick(trigger);
    c = _r3;
    console.log("c=" + c);
});